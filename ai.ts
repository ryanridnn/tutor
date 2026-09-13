import { streamText, type ModelMessage } from "ai";
import { keyKiller } from "./helpers";
import readline from "readline";

let TARGET_FILE = "/tmp/tutor-chat.json";
let LAST_CHAT_FILE = "/tmp/last-chat.md";

export class Ai {
  model = "xiaomi/mimo-v2.5";
  image: Buffer | null = null;
  prompt: string | null = null;

  constructor() {}

  async saveLastChat(chat: string) {
    await Bun.write(LAST_CHAT_FILE, chat);
  }

  async openLastChat() {
    Bun.spawn(["gedit", LAST_CHAT_FILE]);
  }

  async getChat() {
    try {
      const file = Bun.file(TARGET_FILE);

      if (!(await file.exists())) {
        return [];
      }

      try {
        return file.json();
      } catch (e) {
        return [];
      }
    } catch (e) {
      return [];
    }
  }

  async saveChat(chat: ModelMessage[]) {
    await Bun.write(TARGET_FILE, JSON.stringify(chat));
  }

  async eraseChat() {
    await Bun.write(TARGET_FILE, "[]");
  }

  async cutChat() {
    const chat = await this.getChat();

    if (chat.length > 10) {
      const newChat = chat.slice(chat.length - 11, chat.length);

      await this.saveChat(newChat);
    }
  }

  async formChat() {
    if (!this.prompt) {
      return false;
    } else {
      const chat = await this.getChat();

      if (this.image) {
        const message = {
          role: "user",
          content: [
            {
              type: "text",
              text: this.prompt,
            },
            {
              type: "image",
              image: this.image,
              mediaType: "image/png",
            },
          ],
        };

        return chat.concat(message);
      } else {
        const message = {
          role: "user",
          content: [
            {
              type: "text",
              text: this.prompt,
            },
          ],
        } as ModelMessage;

        return chat.concat(message);
      }
    }
  }

  async ai() {
    const chat = await this.formChat();

    if (!chat) {
      console.error("No Chat to Process");
      return;
    }

    const abortController = new AbortController();

    const result = streamText({
      model: this.model,
      messages: chat,
      onFinish: async ({ text }) => {
        const messages = chat.concat({
          role: "assistant",
          content: [
            {
              type: "text",
              text,
            },
          ],
        });

        this.saveLastChat(text);

        await this.saveChat(messages);
      },
      abortSignal: abortController.signal,
    });

    process.stdout.write("Processing...\n\n");

    const normalize = keyKiller(async () => {
      abortController.abort();
      await this.saveChat(chat);
    });

    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
    }

    process.stdout.write("\n");
    normalize();

    this.image = null;
    this.prompt = null;
  }

  async qaMode() {
    let arr: string[] = [];

    const ask = (index: number = 0) => {
      const _res = prompt(`Q${index + 1}?`);

      if (_res && _res !== "q") {
        arr.push(_res);
        ask(index + 1);
      }
    };

    ask();

    if (arr.length > 0) {
      let template =
        "This is QA mode, in the next response after THIS message, you have to answer the questions per item, make a header for each question and answer each, the questions are below: \n";

      template += arr.map((item, index) => `Q${index + 1}: ${item}`).join("\n");

      return template;
    } else {
      console.log("No questions is supplied");
      return false;
    }
  }
}
