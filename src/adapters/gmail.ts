import type { Message } from "../types/message";
import { getGmailClient } from "../utils/gmailClient";
import { buildMimeRaw } from "../utils/mime";

type Adapter = { send: (msg: Message) => Promise<unknown> };

export const gmailAdapter: Adapter = {
  async send(msg) {
    // Règle: subject requis (déjà validé par Zod côté schema)
    const subject = msg.content.subject!;
    const text = msg.content.text;
    const from = process.env.GMAIL_SENDER!;
    const raw = buildMimeRaw(msg.to, from, subject, text);

    const gmail = getGmailClient();
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return {
      status: "sent",
      id: res.data.id,
      threadId: res.data.threadId,
    };
  },
};
