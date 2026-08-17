"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import {
  loginSchema,
  signupSchema,
  zodToState,
  type ActionState,
} from "@/lib/validation";

/** Only allow same-origin relative paths as a post-login destination. */
function safeNext(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limit = await rateLimit("signup");
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return zodToState(parsed.error);

  const { name, email, password } = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length) {
    return {
      ok: false,
      fieldErrors: { email: ["An account with that email already exists."] },
    };
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash })
    .returning({ id: users.id });

  await createSession(user.id);
  redirect(safeNext(formData.get("next")) ?? "/list");
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return zodToState(parsed.error);

  // Bucketed per IP *and* per email, so one attacker cannot lock out an account
  // by burning its allowance from somewhere else.
  const limit = await rateLimit("login", parsed.data.email);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  // Same message either way, so the form cannot be used to enumerate accounts.
  const invalid: ActionState = {
    ok: false,
    message: "That email and password combination did not match.",
  };

  if (!rows.length) {
    // Burn comparable time on a miss to blunt timing analysis.
    await verifyPassword(parsed.data.password, "$2a$12$" + "x".repeat(53));
    return invalid;
  }

  const valid = await verifyPassword(parsed.data.password, rows[0].passwordHash);
  if (!valid) return invalid;

  await createSession(rows[0].id);
  redirect(safeNext(formData.get("next")) ?? "/list");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
