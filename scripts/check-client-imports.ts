import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Fails if a "use client" file imports (directly) a module marked server-only.
 *
 * `tsc` cannot see this and a build may not either, but the page that renders
 * the component 500s at request time - exactly what happened to the help post
 * form. Cheap to check statically, so it is.
 */
const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const files = walk(SRC);
const serverOnly = new Set<string>();
for (const f of files) {
  if (/^\s*import\s+["']server-only["']/m.test(readFileSync(f, "utf8"))) {
    serverOnly.add(relative(SRC, f).replace(/\\/g, "/").replace(/\.(ts|tsx)$/, ""));
  }
}

let bad = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  if (!/^\s*["']use client["']/m.test(src.split("\n").slice(0, 3).join("\n"))) continue;

  for (const m of src.matchAll(/from\s+["']@\/([^"']+)["']/g)) {
    if (serverOnly.has(m[1])) {
      console.log(`FAIL  ${relative(SRC, f)} imports server-only "@/${m[1]}"`);
      bad++;
    }
  }
}

console.log(
  bad === 0
    ? `PASS  no client component imports a server-only module (${serverOnly.size} server-only modules checked)`
    : `\n${bad} problem(s).`,
);
if (bad) process.exit(1);
