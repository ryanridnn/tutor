import { streamText, type ModelMessage } from "ai";
import { keyKiller } from "./helpers";
import readline from "readline";

let TARGET_FILE = "/tmp/tutor-chat.json";

export class Ai {
  model = "alibaba/qwen3.7-flash";
  image: Buffer | null = null;
  prompt: string | null = null;

  constructor() {}

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
}
