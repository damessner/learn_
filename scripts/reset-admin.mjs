#!/usr/bin/env node
// Standalone Admin-Reset für die Learn-Plattform
// Läuft ohne Prisma — benutzt better-sqlite3 + bcryptjs direkt
// Usage: node scripts/reset-admin.mjs <username> <password>

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "..", "dev.db");

const args = process.argv.slice(2);

function printUsage() {
  console.log(`
Usage:
  node reset-admin.mjs <username> <password>     Create/update admin
  node reset-admin.mjs --list                     List all users
  node reset-admin.mjs --activate <username>      Activate a user
`);
}

if (args.length === 0 || args[0] === "--help") {
  printUsage();
  process.exit(0);
}

const db = new Database(dbPath);

if (args[0] === "--list") {
  const rows = db.prepare("SELECT username, role, active FROM User ORDER BY username").all();
  console.log("\nUsers:");
  for (const r of rows) {
    console.log(`  ${r.username.padEnd(20)} ${r.role.padEnd(10)} ${r.active ? "✅ active" : "❌ inactive"}`);
  }
  db.close();
  process.exit(0);
}

if (args[0] === "--activate") {
  const username = args[1]?.trim().toLowerCase();
  if (!username) { console.error("Missing username."); printUsage(); process.exit(1); }
  const result = db.prepare("UPDATE User SET active = 1 WHERE username = ?").run(username);
  db.close();
  if (result.changes > 0) {
    console.log(`✅ User '${username}' activated.`);
  } else {
    console.log(`❌ User '${username}' not found.`);
    process.exit(1);
  }
  process.exit(0);
}

if (args.length < 2) {
  console.error("Missing arguments.");
  printUsage();
  process.exit(1);
}

const username = args[0].trim().toLowerCase();
const password = args[1];
if (password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

const passwordHash = bcrypt.hashSync(password, 10);
const existing = db.prepare("SELECT id FROM User WHERE username = ?").get(username);

if (existing) {
  db.prepare("UPDATE User SET passwordHash = ?, role = 'ADMIN', active = 1 WHERE username = ?").run(passwordHash, username);
  console.log(`✅ Admin '${username}' updated with new password.`);
} else {
  const id = randomUUID();
  db.prepare("INSERT INTO User (id, username, passwordHash, role, active) VALUES (?, ?, ?, 'ADMIN', 1)").run(id, username, passwordHash);
  console.log(`✅ Admin '${username}' created.`);
}

db.close();
