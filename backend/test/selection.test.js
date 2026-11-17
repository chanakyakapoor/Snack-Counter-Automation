import test from "node:test";
import assert from "node:assert/strict";
import { selectVolunteers } from "../src/selection.js";
import { config } from "../src/config.js";

test("Selection skips away, excluded, expired visitors and exposure caps, then ranks deterministically", () => {
  const now = Date.parse("2026-11-10T08:00:00Z"),
    day = 86_400_000;
  const employees = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "away",
    "full",
    "visitor",
    "expired",
    "excluded",
  ].map((employeeId) => ({
    employeeId,
    isVolunteer: true,
    homeOffice: ["visitor", "expired"].includes(employeeId)
      ? "bengaluru"
      : "oslo",
  }));
  employees.find((e) => e.employeeId === "away").awayUntil = "2026-11-11";
  employees.push({
    employeeId: "admin",
    homeOffice: "oslo",
    isVolunteer: false,
  });
  const purchase = (
    id,
    amountMinor,
    days,
    state = "REIMBURSED",
    currency = "NOK",
  ) => ({
    committedBy: id,
    state,
    purchase: { amountMinor, currency, purchasedAt: now - days * day },
  });
  const refills = [
    purchase("full", 300_000, 1, "CLAIM_SUBMITTED"),
    purchase("e", 100, 3, "PURCHASED"),
    purchase("c", 500, 20),
    purchase("d", 500, 2),
    purchase("a", 900_000, 90, "CLAIM_SUBMITTED", "INR"),
  ];
  const visits = ["visitor", "expired"].map((employeeId) => ({
    employeeId,
    officeId: "oslo",
    from: "2026-11-01",
    to: employeeId === "visitor" ? "2026-11-12" : "2026-11-09",
  }));
  const result = selectVolunteers({
    employees,
    visits,
    refills,
    now,
    officeId: "oslo",
    office: config.offices.oslo,
    excluded: ["excluded"],
    historyWindow: config.historyWindow,
  });
  assert.deepEqual(result, ["b", "visitor", "a", "c", "d", "e"]);
});
