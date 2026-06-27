import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDatabaseUrl() {
  // In Vercel serverless, filesystem is read-only except /tmp
  // Copy the seeded dev.db to /tmp so Prisma can open it
  if (process.env.VERCEL) {
    const sourcePath = path.join(__dirname, "..", "prisma", "dev.db");
    const tmpPath = "/tmp/dev.db";
    if (!fs.existsSync(tmpPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, tmpPath);
    }
    return "file:/tmp/dev.db";
  }
  return process.env.DATABASE_URL || "file:./dev.db";
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
});
