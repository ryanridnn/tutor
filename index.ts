import { Image, write, $ } from "bun";
import readline from "readline";
import { Ai } from "./ai";
import { keyKiller } from "./helpers";

class App {
  stop = false;
  ai = new Ai();

  constructor() {}

  ask() {
    const _res = prompt("your chat > ");

    return _res;
  }

  async getClip() {
    if (Image) {
      const img = Image.fromClipboard();

      if (img) {
        return img.bytes();
      }
    }

    if (process.platform === "linux") {
      try {
        const proc = Bun.spawn([
          "xclip",
          "-selection",
          "clipboard",
          "-t",
          "image/png",
          "-o",
        ]);

        const bytes = await proc.stdout.bytes();

        return bytes.length > 0 ? bytes : null;
      } catch (e) {
        const proc = Bun.spawn(["wl-paste", "-t", "image/png"]);

        const bytes = await proc.stdout.bytes();

        if (bytes.length > 0) {
          return bytes;
        } else {
          return null;
        }
      }
    } else {
      return null;
    }
  }

  async readClip() {
    const img = await this.getClip();

    if (img) {
      const buffer = Buffer.from(img);
      this.ai.image = buffer;
    }
  }

  async playAudio() {
    const proc = Bun.spawn(["aplay", "/tmp/tutor.wav"]);

    await proc.exited;
  }

  async recordAudio() {
    const proc = Bun.spawn(["arecord", "-f", "cd", "/tmp/tutor.wav"]);
    console.log("Press c to stop recording");

    keyKiller(() => {
      proc.kill();
    });

    await proc.exited;

    this.playAudio();
  }

  async transcribe() {
    const transcribe_loop = async () => {
      await this.recordAudio();

      const proc =
        $`./whisper-cli -otxt -nt -np -m ./models/ggml-base.en.bin -f  /tmp/tutor.wav`.quiet();

      await proc;

      const text = await Bun.file("/tmp/tutor.wav.txt").text();

      console.log(`Prompt: ${text}`);

      return text;
    };

    while (true) {
      const text = await transcribe_loop();
      const resp = prompt("Good?: ");

      if (resp === "" || resp === null) {
        return text;
      } else {
        console.log("Record again");
        continue;
      }
    }
  }

  async loop() {
    const _res = this.ask();

    if (_res === "p") {
      await this.readClip();
    } else if (_res === "o") {
      const text = await this.transcribe();
      this.ai.prompt = text;

      await this.ai.ai();
    } else if (_res === "c") {
      this.stop = true;
    } else if (_res === "m") {
      await this.ai.eraseChat();
      console.log("Chat has been erased");
    } else if (_res === "cut") {
      await this.ai.cutChat();
      console.log("Chat has been cut");
    } else if (_res === "op") {
      this.ai.openLastChat();
    } else if (_res === "qa") {
      const template = await this.ai.qaMode();

      if (template) {
        this.ai.prompt = template;
        await this.ai.ai();
      }
    } else {
      this.ai.prompt = _res;
      await this.ai.ai();
    }
  }

  async main() {
    while (!this.stop) {
      await this.loop();
    }
  }
}

const app = new App();

app.main();
