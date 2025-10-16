import { mockAdapter } from "./mock";
import { gmailAdapter } from "./gmail";

export const adapters = {
  whatsapp: mockAdapter,
  teams: mockAdapter,
  gmail: gmailAdapter,
} as const;

export type SupportedChannel = keyof typeof adapters;
