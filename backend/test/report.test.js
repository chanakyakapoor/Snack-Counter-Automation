import test from "node:test";
import assert from "node:assert/strict";
import { world, committed, receiptInput } from "./helpers.js";
import { createReportService } from "../src/reportService.js";

test("Monthly reports combine native totals in NOK, freeze the rate, use local months and separate pending approval", async () => {
  const w = world("2026-10-31T20:00:00Z"),
    reports = createReportService(w);
  async function buy(office, amount) {
    const refill = await committed(w, office);
    return w.service.receipt(
      refill.id,
      refill.committedBy,
      receiptInput(amount),
    );
  }
  await buy("oslo", 90_000);
  await buy("bengaluru", 200_000); // 01:30 on November 1 in Bengaluru.
  w.clock.advance(3.5 * 60 * 60 * 1000);
  await buy("oslo", 10_000); // 00:30 on November 1 in Oslo.
  await buy("bengaluru", 80_000);
  await buy("oslo", 130_000); // Pending approval, outside the spend and item totals.
  const october = await reports.monthlyReport("2026-10");
  assert.equal(october.combinedMinor, 90_000);
  assert.equal(october.perOffice.bengaluru.totalMinor, 0);
  const november = await reports.monthlyReport("2026-11");
  assert.deepEqual(november.perOffice, {
    oslo: {
      totalMinor: 10_000,
      currency: "NOK",
      refillCount: 1,
      pendingApprovalMinor: 130_000,
    },
    bengaluru: {
      totalMinor: 280_000,
      currency: "INR",
      refillCount: 2,
      pendingApprovalMinor: 0,
    },
  });
  assert.equal(november.combinedMinor, 45_000);
  assert.deepEqual(november.topItems, [{ name: "nuts", qty: 6 }]);
  assert.deepEqual(november.fxRate, w.config.fxRate);
  w.config.fxRate.numerator = 2;
  assert.equal(november.fxRate.numerator, 1);
  assert.equal((await reports.monthlyReport("2026-12")).combinedMinor, 0);
});
