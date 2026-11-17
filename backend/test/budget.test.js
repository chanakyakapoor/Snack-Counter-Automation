import test from "node:test";
import assert from "node:assert/strict";
import { budget, monthOf } from "../src/budget.js";
import { config } from "../src/config.js";

test("Budgets keep NOK and INR independent and use the office calendar month", () => {
  const now = Date.parse("2026-11-10T00:00:00Z");
  const refills = [
    {
      officeId: "oslo",
      state: "REIMBURSED",
      purchase: { amountMinor: 100_000, purchasedAt: now },
    },
    {
      officeId: "bengaluru",
      state: "PURCHASED",
      purchase: { amountMinor: 250_000, purchasedAt: now },
    },
    { officeId: "oslo", state: "COMMITTED", reservedMinor: 120_000 },
  ];
  assert.deepEqual(budget(refills, "oslo", config.offices.oslo, now), {
    month: "2026-11",
    currency: "NOK",
    spent: 100_000,
    reserved: 120_000,
    remaining: 380_000,
  });
  assert.equal(
    budget(refills, "bengaluru", config.offices.bengaluru, now).remaining,
    1_250_000,
  );
  assert.equal(monthOf("2026-10-31T23:30:00Z", "Asia/Kolkata"), "2026-11");
  assert.equal(monthOf("2026-10-31T20:00:00Z", "Europe/Oslo"), "2026-10");
});
