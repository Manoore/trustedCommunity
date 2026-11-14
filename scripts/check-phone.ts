import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import { safeNext, dailySendCap } from "../src/lib/phone-verify";
import {
  buildAuthTemplateBody,
  classifyWhatsAppError,
  whatsAppFailureMessage,
} from "../src/lib/whatsapp-format";

/**
 * Checks for phone verification: the Meta request shape, how Meta's errors are
 * read, the redirect guard, and the database rule that one number can back only
 * one account. Needs the local database, not a server.
 *
 * What this cannot prove is delivery to a real handset. That needs live Meta
 * credentials; README says how to test it.
 */
let ok = true;
function assert(label: string, condition: boolean) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) ok = false;
}

async function main() {
  /* ----------------------------------------------- the request Meta gets */
  const body = buildAuthTemplateBody({
    to: "+919848012345",
    code: "123456",
    template: "trusted_by_code",
    language: "en_US",
  });
  assert("recipient is digits only, no plus", body.to === "919848012345");
  assert("sends a template message", body.type === "template" && body.messaging_product === "whatsapp");
  assert("template name and language are passed", body.template.name === "trusted_by_code" && body.template.language.code === "en_US");

  const [bodyComp, buttonComp] = body.template.components;
  assert("code is in the body component", bodyComp.type === "body" && bodyComp.parameters[0].text === "123456");
  assert(
    "code is repeated in the copy-code button (index 0, sub_type url)",
    buttonComp.type === "button" &&
      "sub_type" in buttonComp && buttonComp.sub_type === "url" &&
      "index" in buttonComp && buttonComp.index === "0" &&
      buttonComp.parameters[0].text === "123456",
  );

  /* ------------------------------------------------ reading Meta's errors */
  const err = (code: number, message = "x") => ({ error: { code, message } });
  assert("131026 -> not on WhatsApp", classifyWhatsAppError(err(131026)).reason === "not_on_whatsapp");
  assert("131030 -> not an allowed test recipient", classifyWhatsAppError(err(131030)).reason === "not_allowed");
  assert("130429 -> throttled", classifyWhatsAppError(err(130429)).reason === "throttled");
  assert("190 (bad token) -> our config, not the user", classifyWhatsAppError(err(190)).reason === "config");
  assert("132001 (no such template) -> our config", classifyWhatsAppError(err(132001)).reason === "config");
  assert("unknown code -> unknown", classifyWhatsAppError(err(999999)).reason === "unknown");
  assert("garbage body -> unknown, no crash", classifyWhatsAppError(null).reason === "unknown");

  for (const reason of ["not_on_whatsapp", "not_allowed", "throttled", "config", "unknown"] as const) {
    const msg = whatsAppFailureMessage(reason);
    assert(`user message for ${reason} leaks no internals`, !/token|template|graph|meta|code \d/i.test(msg));
  }

  /* --------------------------------------------------- redirect guard */
  assert("safeNext keeps a local path", safeNext("/recommendations/new") === "/recommendations/new");
  assert("safeNext blocks //evil.com", safeNext("//evil.com") === "/list");
  assert("safeNext blocks https://evil.com", safeNext("https://evil.com") === "/list");
  assert("safeNext blocks backslash tricks", safeNext("/\\evil.com") === "/list");
  assert("daily cap has a sane default", dailySendCap() === 300 || Number(process.env.OTP_DAILY_CAP) > 0);

  /* --------------------------- one number, one account (database rule) */
  const phone = `+1555${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}`;
  const mk = async (tag: string) => {
    const [u] = await db.execute<{ id: string }>(sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${`phonecheck-${tag}-${randomBytes(4).toString("hex")}@example.com`}, 'x', ${`Phone Check ${tag}`})
      RETURNING id`);
    return u.id;
  };
  const a = await mk("a");
  const b = await mk("b");
  try {
    await db.execute(sql`UPDATE users SET verified_phone = ${phone}, phone_verified_at = now() WHERE id = ${a}::uuid`);
    let blocked = false;
    try {
      await db.execute(sql`UPDATE users SET verified_phone = ${phone}, phone_verified_at = now() WHERE id = ${b}::uuid`);
    } catch {
      blocked = true;
    }
    assert("a second account cannot verify the same number", blocked);

    await db.execute(sql`UPDATE users SET verified_phone = NULL WHERE id = ${a}::uuid`);
    await db.execute(sql`UPDATE users SET verified_phone = ${phone} WHERE id = ${b}::uuid`);
    assert("a freed number can be verified by someone else", true);

    await db.execute(sql`INSERT INTO phone_verifications (user_id, phone, code_hash, expires_at)
                         VALUES (${a}::uuid, ${phone}, 'h', now() + interval '10 minutes')`);
    const [row] = await db.execute<{ attempts: number; channel: string }>(
      sql`SELECT attempts, channel FROM phone_verifications WHERE user_id = ${a}::uuid`,
    );
    assert("code rows default to 0 attempts on whatsapp", row.attempts === 0 && row.channel === "whatsapp");
  } finally {
    await db.execute(sql`DELETE FROM users WHERE id IN (${a}::uuid, ${b}::uuid)`);
  }
  const [left] = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int n FROM phone_verifications WHERE phone = ${phone}`,
  );
  assert("deleting a user removes their verification rows", left.n === 0);

  console.log(ok ? "\nAll phone checks passed." : "\nSome phone checks FAILED.");
  await conn.end();
  if (!ok) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await conn.end();
  process.exit(1);
});
