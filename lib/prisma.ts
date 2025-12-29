import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as path from "path";

// Use absolute path to ensure consistency across app and seed script
// Resolve relative paths to absolute to avoid readonly issues
let dbPath: string;
if (process.env.DATABASE_URL) {
  const urlPath = process.env.DATABASE_URL.replace(/^file:/, "");
  dbPath = path.isAbsolute(urlPath) ? urlPath : path.resolve(process.cwd(), urlPath);
} else {
  dbPath = path.join(process.cwd(), "prisma", "dev.db");
}

const url = `file:${dbPath}`;
const adapter = new PrismaBetterSqlite3({ url });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
