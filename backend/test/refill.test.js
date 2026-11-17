import test from "node:test";
import assert from "node:assert/strict";
import { world, committed, receiptInput } from "./helpers.js";
import { budget } from "../src/budget.js";

test("An open refill older than 24 hours escalates even with candidates left", async () => {
  const w = world(), { refill } = await w.service.empty("oslo");
  w.clock.advance(w.config.escalationWindow + 1);
  await w.service.tick();
  assert.equal((await w.store.getRefill(refill.id)).offeredTo.length, 3);
  w.clock.advance(w.config.offerWindow);
  await w.service.tick();
  assert.equal(w.chat.messages.filter(m => m.type === "admin").length, 1);
});

test("Escalation at epoch zero is recorded once, not treated as missing", async () => {
  const w = world("1970-01-01T00:00:00Z");
  w.store.employees.forEach(e => { e.isVolunteer = false; });
  const { refill } = await w.service.empty("oslo");
  assert.equal(refill.escalatedAt, 0);
  w.clock.advance(w.config.offerWindow);
  await w.service.tick();
  assert.equal(w.chat.messages.filter(m => m.type === "admin").length, 1);
});

test("A second empty report returns the one active refill, including concurrent reports", async () => {
  const w = world();
  const results = await Promise.all([
    w.service.empty("oslo"),
    w.service.empty("oslo"),
  ]);
  assert.equal(results[0].refill.id, results[1].refill.id);
  assert.equal(results.filter((r) => r.existing).length, 1);
  assert.equal((await w.store.listRefills()).length, 1);
});
test("Two offered volunteers accepting concurrently produce one winner and one reservation", async () => {
  const w = world(),
    { refill } = await w.service.empty("oslo");
  const results = await Promise.all(
    refill.offeredTo.slice(0, 2).map((id) => w.service.accept(refill.id, id)),
  );
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.find((r) => !r.ok).reason, "ALREADY_TAKEN");
  assert.equal(
    budget(
      await w.store.listRefills(),
      "oslo",
      w.config.offices.oslo,
      w.clock.now(),
    ).reserved,
    120_000,
  );
});
test("A volunteer who was not offered cannot accept; expired buttons cannot accept", async () => {
  const w = world(),
    { refill } = await w.service.empty("oslo");
  assert.equal(
    (await w.service.accept(refill.id, "oslo9")).reason,
    "NOT_OFFERED",
  );
  w.clock.advance(w.config.offerWindow);
  assert.equal(
    (await w.service.accept(refill.id, refill.offeredTo[0])).reason,
    "OFFER_EXPIRED",
  );
});
test("An unanswered offer goes to the next three and exhaustion escalates only once", async () => {
  const w = world(),
    { refill } = await w.service.empty("oslo");
  for (let batch = 1; batch <= 4; batch++) {
    w.clock.advance(w.config.offerWindow);
    await Promise.all([w.service.tick(), w.service.tick()]);
    const current = await w.store.getRefill(refill.id);
    assert.equal(
      new Set(current.offeredHistory).size,
      current.offeredHistory.length,
    );
    assert.deepEqual(
      current.offeredTo,
      batch === 1
        ? ["oslo4", "oslo5", "oslo6"]
        : batch === 2
          ? ["oslo7", "oslo8", "oslo9"]
          : [],
    );
  }
  assert.equal(w.chat.messages.filter((m) => m.type === "admin").length, 1);
});
test("A missed 24-hour commitment releases the reservation and hands over to new candidates", async () => {
  const w = world(),
    refill = await committed(w);
  w.clock.advance(w.config.buyWindow);
  await w.service.tick();
  const next = await w.store.getRefill(refill.id);
  assert.equal(next.state, "OPEN");
  assert.equal(next.reservedMinor, 0);
  assert.deepEqual(next.excluded, [refill.committedBy]);
  assert.deepEqual(next.offeredTo, ["oslo4", "oslo5", "oslo6"]);
  assert.equal(
    (await w.service.receipt(refill.id, refill.committedBy, receiptInput()))
      .reason,
    "NOT_COMMITTED",
  );
});
test("Withdrawal releases the reservation and excludes the buyer only for this refill", async () => {
  const w = world(),
    refill = await committed(w);
  const next = (await w.service.withdraw(refill.id, refill.committedBy)).refill;
  assert.equal(next.state, "OPEN");
  assert.equal(next.reservedMinor, 0);
  assert.deepEqual(next.excluded, [refill.committedBy]);
  assert.deepEqual(next.offeredTo, ["oslo4", "oslo5", "oslo6"]);
});
test("Accept rejects insufficient remaining budget while the other office is independent", async () => {
  const w = world();
  w.config.offices.oslo.monthlyBudget = 119_999;
  const { refill } = await w.service.empty("oslo");
  assert.equal(
    (await w.service.accept(refill.id, refill.offeredTo[0])).reason,
    "INSUFFICIENT_BUDGET",
  );
  assert.equal((await committed(w, "bengaluru")).reservedMinor, 300_000);
  assert.equal(w.chat.messages.filter((m) => m.type === "admin").length, 1);
});
test("Over-cap or over-budget receipts need admin approval before HR; denial cancels", async () => {
  for (const overBudget of [false, true]) {
    const w = world(),
      refill = await committed(w);
    if (overBudget) w.config.offices.oslo.monthlyBudget = 80_000;
    const result = await w.service.receipt(
      refill.id,
      refill.committedBy,
      receiptInput(overBudget ? 90_000 : 130_000),
    );
    assert.equal(result.refill.state, "NEEDS_APPROVAL");
    assert.equal(result.refill.reservedMinor, 0);
    assert.equal(w.hr.calls.length, 0);
    assert.equal(
      (await w.service.decide(refill.id, "bengaluru-admin", true)).reason,
      "NOT_ADMIN",
    );
    assert.equal(
      (await w.service.decide(refill.id, "oslo-admin", false)).refill.state,
      "CANCELLED",
    );
  }
});
test("Invalid receipts retain the commitment and concurrent receipts record one purchase", async () => {
  const w = world(),
    refill = await committed(w);
  for (const input of [
    receiptInput(1.1),
    { ...receiptInput(), items: [] },
    { ...receiptInput(), currency: "INR" },
    { ...receiptInput(), receiptRef: "" },
  ])
    assert.equal(
      (await w.service.receipt(refill.id, refill.committedBy, input)).reason,
      "INVALID_RECEIPT",
    );
  const results = await Promise.all(
    [1, 2].map(() =>
      w.service.receipt(refill.id, refill.committedBy, receiptInput()),
    ),
  );
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal((await w.store.getRefill(refill.id)).reservedMinor, 0);
  assert.equal(w.chat.messages.filter((m) => m.type === "channel").length, 1);
});
