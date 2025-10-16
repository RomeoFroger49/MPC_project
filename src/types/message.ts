import { z } from "zod";

export const Channel = z.enum(["whatsapp", "gmail", "teams"]);
export type Channel = z.infer<typeof Channel>;

const Content = z.object({
  text: z.string().min(1, "content.text est requis"),
  subject: z.string().optional(), // requis seulement si channel = gmail (cf. refine ci-dessous)
});

export const MessageSchema = z
  .object({
    channel: Channel,
    to: z.string().min(1, "`to` est requis"),
    content: Content,
  })
  .superRefine((val, ctx) => {
    if (val.channel === "gmail" && !val.content.subject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "content.subject est requis pour le channel 'gmail'",
        path: ["content", "subject"],
      });
    }
  });

export type Message = z.infer<typeof MessageSchema>;

export function validateMessage(payload: unknown): Message {
  const parsed = MessageSchema.safeParse(payload);
  if (!parsed.success) {
    // On concatène les messages d’erreur pour un retour API plus lisible
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Payload invalide: ${issues}`);
  }
  return parsed.data;
}
