/**
 * Seeds DeliveryAddress rows from the workspace CSV (Distributor ID = customer User.id).
 *
 * Default CSV path: <repo root>/delivery address.csv (three levels above this file).
 * Override: pass path as first CLI arg, or set DELIVERY_ADDRESS_CSV_PATH.
 *
 * Run from backend: npx ts-node src/scripts/seedDeliveryAddressesFromCsv.ts
 */

import fs from "fs";
import path from "path";
import "dotenv/config";
import { prisma } from "../lib/prisma";

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += c;
      i++;
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === ",") {
        result.push(cur);
        cur = "";
        i++;
        continue;
      }
      cur += c;
      i++;
    }
  }
  result.push(cur);
  return result;
}

function parseTwoSideDistance(raw: string): number {
  const t = raw.trim();
  if (t === "" || t === "-") return 0;
  const m = t.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function normalizePincode(raw: string): string {
  const t = raw.trim();
  if (t === "" || t === "-") return "000000";
  return t.slice(0, 32);
}

function normalizeState(raw: string): string {
  const t = raw.trim();
  if (t === "" || t === "-") return "NOT_SET";
  return t.slice(0, 128);
}

function resolveCsvPath(): string {
  const fromEnv = process.env.DELIVERY_ADDRESS_CSV_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const arg = process.argv[2]?.trim();
  if (arg) return path.resolve(arg);
  return path.resolve(__dirname, "../../../delivery address.csv");
}

async function main() {
  const csvPath = resolveCsvPath();
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);

  const header = lines[0];
  if (!header?.includes("Distributor ID")) {
    console.error("Unexpected CSV: first line must contain header with 'Distributor ID'.");
    process.exit(1);
  }

  type Row = {
    userId: string;
    twoSideDistance: number;
    state: string;
    address: string;
    pincode: string;
  };

  const rows: Row[] = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line?.trim()) continue;

    const cols = parseCsvLine(line);
    if (cols.length < 6) {
      console.warn(`Skipping line ${li + 1}: expected at least 6 columns, got ${cols.length}`);
      continue;
    }

    const userId = cols[0].trim();
    if (!OBJECT_ID_RE.test(userId)) {
      console.warn(`Skipping line ${li + 1}: invalid Distributor ID "${userId}"`);
      continue;
    }

    const address = cols[4].trim();
    if (!address) {
      console.warn(`Skipping line ${li + 1}: empty address for user ${userId}`);
      continue;
    }

    rows.push({
      userId,
      twoSideDistance: parseTwoSideDistance(cols[1] ?? ""),
      state: normalizeState(cols[3] ?? ""),
      address,
      pincode: normalizePincode(cols[5] ?? ""),
    });
  }

  const distinctUserIds = [...new Set(rows.map((r) => r.userId))];
  const existingUsers = await prisma.user.findMany({
    where: { id: { in: distinctUserIds } },
    select: { id: true },
  });
  const validUserIds = new Set(existingUsers.map((u) => u.id));
  const missing = distinctUserIds.filter((id) => !validUserIds.has(id));
  if (missing.length) {
    console.warn(
      `${missing.length} Distributor ID(s) have no matching User; those rows will be skipped. Example: ${missing[0]}`
    );
  }

  const toInsert = rows.filter((r) => validUserIds.has(r.userId));
  if (!toInsert.length) {
    console.log("No rows to insert (no matching users or empty data).");
    return;
  }

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const res = await prisma.deliveryAddress.createMany({
      data: chunk.map((r) => ({
        userId: r.userId,
        default: false,
        address: r.address,
        twoSideDistance: r.twoSideDistance,
        pincode: r.pincode,
        state: r.state,
      })),
    });
    inserted += res.count;
  }

  console.log(`Inserted ${inserted} delivery address(es) from ${rows.length} CSV row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
