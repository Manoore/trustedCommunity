import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import { sessions, users } from "../src/db/schema";

/**
 * Test helper: mints a login session for an existing account and prints the
 * cookie value, so HTTP-level checks can exercise signed-in routes without
 * driving the login form. Development use only.
 */
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("usage: tsx scripts/mint-session.ts <email>");
    process.exit(1);
  }

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  const token = randomBytes(32).toString("base64url");
  const id = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ id, userId: user.id, expiresAt });
  console.log(`${user.role}\t${token}`);
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
