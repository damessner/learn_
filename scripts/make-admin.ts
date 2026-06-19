import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import * as path from "path";

const DB_URL = process.env.DATABASE_URL || "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: DB_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage:
  npx tsx scripts/make-admin.ts <username> <password>     Create/update an admin
  npx tsx scripts/make-admin.ts --activate <username>     Activate existing user
  npx tsx scripts/make-admin.ts --list                    List all users
`);
    process.exit(0);
  }

  if (args[0] === "--list") {
    const users = await prisma.user.findMany({
      select: { username: true, role: true, active: true },
      orderBy: { username: "asc" },
    });
    console.log("\nUsers:");
    for (const u of users) {
      const status = u.active ? "active" : "inactive";
      console.log(`  ${u.username.padEnd(20)} ${u.role.padEnd(10)} ${status}`);
    }
    return;
  }

  if (args[0] === "--activate") {
    const username = args[1].trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error(`User '${username}' not found.`);
      process.exit(1);
    }
    await prisma.user.update({
      where: { username },
      data: { active: true },
    });
    console.log(`✅ User '${username}' activated.`);
    return;
  }

  // Default: create/update admin
  const username = args[0].trim().toLowerCase();
  const password = args[1];

  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { username },
    update: { role: "ADMIN", active: true },
    create: { username, passwordHash, role: "ADMIN", active: true },
  });

  console.log(`✅ Admin '${user.username}' created/updated (active: ${user.active}).`);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
