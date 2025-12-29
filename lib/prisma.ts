import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as path from "path";

const raw = process.env.DATABASE_URL; // expected: "file:./prisma/dev.db" or "file:/abs/path"

// Resolve relative sqlite paths to absolute, so app + seed always hit the same DB file.
let dbPath: string;
if (raw && raw.startsWith("file:")) {
  const urlPath = raw.replace(/^file:/, "");
  dbPath = path.isAbsolute(urlPath)
    ? urlPath
    : path.resolve(process.cwd(), urlPath);
} else {
  dbPath = path.join(process.cwd(), "prisma", "dev.db");
}

const url = `file:${dbPath}`;
const adapter = new PrismaBetterSqlite3({ url });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

