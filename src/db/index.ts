import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
}

// Next.js hot-reloads modules in dev, so cache the pool on globalThis to avoid
// opening a new connection pool on every reload.
const globalForDb = globalThis as unknown as { __pgConn?: postgres.Sql };

const conn = globalForDb.__pgConn ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__pgConn = conn;

export const db = drizzle(conn, { schema });
export { schema };
