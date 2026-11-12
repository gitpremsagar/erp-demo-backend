import assert from "node:assert/strict";
import {
  listRecentIstYmds,
  openingSnapshotDayBounds,
  pickOpeningByProduct,
  reconcileTodayOpeningClosing,
  reconstructOpeningQuantity,
} from "./openingStockSnapshot";
import { toIstYmd } from "./schemeDates";

let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok ${name}`);
    console.error(err);
  }
}

test("opening = current + outward - inward with zero inward", () => {
  assert.equal(reconstructOpeningQuantity(3, 0, 10), 13);
  assert.equal(reconstructOpeningQuantity(812, 30, 30), 812);
});

test("mid-day Bhujia: live 3, outward 10 → opening 13, closing 3", () => {
  const reconciled = reconcileTodayOpeningClosing({
    opening: 3,
    inward: 0,
    outward: 10,
    liveBatchSum: 3,
  });
  assert.equal(reconciled.opening, 13);
  assert.equal(reconciled.closing, 3);
});

test("advance order: outward on deduction day not order day (ledger math)", () => {
  // Stock deducted 18th: live 3, outward-on-18th 10 → morning was 13
  const opening18 = reconstructOpeningQuantity(3, 0, 10);
  assert.equal(opening18, 13);
  assert.equal(opening18 - 10, 3);
  // Order date 19th does not add outward on 19th when changeDate is 18th
  const outwardOn19 = 0;
  assert.equal(3 + outwardOn19, 3);
});

test("pickOpeningByProduct prefers canonical midnight snapshot", () => {
  const ymd = "2026-08-19";
  const { snapshotDate } = openingSnapshotDayBounds(ymd);
  const later = new Date("2026-08-19T09:12:00.000+05:30");
  const picked = pickOpeningByProduct(
    [
      { productId: "p1", quantity: 3, snapshotDate: later },
      { productId: "p1", quantity: 13, snapshotDate },
    ],
    snapshotDate
  );
  assert.equal(picked.get("p1"), 13);
});

test("listRecentIstYmds returns last N inclusive IST days", () => {
  assert.deepEqual(listRecentIstYmds("2026-08-19", 5), [
    "2026-08-15",
    "2026-08-16",
    "2026-08-17",
    "2026-08-18",
    "2026-08-19",
  ]);
});

test("changeDate vs createdAt IST day mismatch detection", () => {
  const createdAt = new Date("2026-08-18T14:30:00.000+05:30");
  const changeDateOrderDay = new Date("2026-08-19T00:00:00.000+05:30");
  assert.notEqual(toIstYmd(changeDateOrderDay), toIstYmd(createdAt));
  assert.equal(toIstYmd(createdAt), "2026-08-18");
  assert.equal(toIstYmd(changeDateOrderDay), "2026-08-19");
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log("\nall tests passed");
