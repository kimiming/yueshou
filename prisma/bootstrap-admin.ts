import { z } from "zod";

const confirmation = "I_UNDERSTAND_BOOTSTRAP_ADMIN";
const placeholder = /(replace|example|change[-_ ]?me|placeholder|correct-horse|password123|admin123)/i;

const bootstrapSchema = z.object({
  INITIAL_ADMIN_EMAIL: z.string().trim().email(),
  INITIAL_ADMIN_PASSWORD: z.string().min(12)
    .regex(/[a-z]/, "must contain a lowercase character")
    .regex(/[A-Z]/, "must contain an uppercase character")
    .regex(/\d/, "must contain a digit")
    .regex(/[^A-Za-z0-9]/, "must contain a symbol")
    .refine((value) => !placeholder.test(value), "must not be a placeholder or commonly compromised password"),
  BOOTSTRAP_ADMIN_CONFIRM: z.literal(confirmation),
});

export function parseBootstrapAdmin(input: Record<string, string | undefined>) {
  const values = [input.INITIAL_ADMIN_EMAIL, input.INITIAL_ADMIN_PASSWORD, input.BOOTSTRAP_ADMIN_CONFIRM];
  if (values.every((value) => !value)) return null;
  const parsed = bootstrapSchema.parse(input);
  return { email: parsed.INITIAL_ADMIN_EMAIL.trim().toLowerCase(), password: parsed.INITIAL_ADMIN_PASSWORD };
}
