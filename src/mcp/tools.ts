import { validateMessage, type Message } from "../types/message";
import { adapters } from "../adapters";

export async function sendMessageTool(payload: unknown) {
  const msg: Message = validateMessage(payload);
  const adapter = adapters[msg.channel];
  if (!adapter) throw new Error(`Unsupported channel: ${msg.channel}`);
  const result = await adapter.send(msg);
  return { tool: "send_message", channel: msg.channel, to: msg.to, result };
}
