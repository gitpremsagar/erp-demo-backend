/**
 * Generates unique ACCESS / REFRESH / CRON secrets and updates .env in place.
 * Usage: node scripts/rotate-jwt-secrets.mjs
 * Does not print secret values.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function gen() {
  return crypto.randomBytes(64).toString("base64");
}

const keys = [
  "ACCESS_TOKEN_JWT_SECRET",
  "REFRESH_TOKEN_JWT_SECRET",
  "CRON_SECRET",
];

const secrets = Object.fromEntries(keys.map((k) => [k, gen()]));

if (!fs.existsSync(envPath)) {
  console.error(".env not found. Copy .env.example to .env first.");
  process.exit(1);
}

let content = fs.readFileSync(envPath, "utf8");
for (const key of keys) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    content = content.replace(re, `${key}=${secrets[key]}`);
  } else {
    content += `\n${key}=${secrets[key]}\n`;
  }
}
fs.writeFileSync(envPath, content, "utf8");
console.log("Updated unique secrets in .env for:", keys.join(", "));
console.log("Apply the same three values in production hosting env vars.");
console.log("All existing sessions will be invalidated.");
