import type { Message } from "../types/message";

type Adapter = { send: (msg: Message) => Promise<unknown> };

export const mockAdapter: Adapter = {
  async send(msg) {
    return {
      status: "queued",
      correlation_id: `mock_${Date.now()}`,
      echo: { channel: msg.channel, to: msg.to, text: msg.content.text },
    };
  },
};
