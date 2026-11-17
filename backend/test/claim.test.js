import test from "node:test";
import assert from "node:assert/strict";
import { world, committed, receiptInput } from "./helpers.js";

test("A receipt automatically creates a complete HR claim in the visited office currency", async () => {
  const w = world();
  w.store.employees
    .filter((e) => e.homeOffice === "bengaluru")
    .forEach((e) => {
      e.isVolunteer = false;
    });
  w.store.visits.push({
    employeeId: "oslo1",
    officeId: "bengaluru",
    from: "2026-11-01",
    to: "2026-11-20",
  });
  const refill = await committed(w, "bengaluru");
  assert.equal(refill.committedBy, "oslo1");
  const result = await w.service.receipt(
    refill.id,
    refill.committedBy,
    receiptInput(200_000),
  );
  assert.equal(result.refill.state, "CLAIM_SUBMITTED");
  assert.deepEqual(w.hr.calls[0], {
    key: refill.id,
    amountMinor: 200_000,
    currency: "INR",
    description: "Snack refill – Bengaluru – 2026-11",
    receiptRef: "mock://receipt.png",
    employeeId: "oslo1",
  });
  const fields = { ...w.hr.calls[0] };
  for (const field of [
    "amountMinor",
    "currency",
    "description",
    "receiptRef",
    "employeeId",
  ]) {
    const invalid = { ...fields };
    delete invalid[field];
    await assert.rejects(w.hr.createClaim("invalid-" + field, invalid));
  }
});
test("Admin approval creates the claim immediately and releases the reservation", async () => {
  const w = world(),
    refill = await committed(w);
  await w.service.receipt(refill.id, refill.committedBy, receiptInput(130_000));
  assert.equal(w.hr.calls.length, 0);
  const result = await w.service.decide(refill.id, "oslo-admin", true);
  assert.equal(result.refill.state, "CLAIM_SUBMITTED");
  assert.equal(w.hr.claims.size, 1);
  assert.equal(result.refill.reservedMinor, 0);
  assert.equal((await w.service.empty("oslo")).existing, false);
});
test("HR failure retries on tick; a lost response and concurrent retries create only one HR claim", async () => {
  for (const loseResponse of [false, true]) {
    const w = world(),
      refill = await committed(w);
    if (loseResponse) w.hr.loseNextResponse();
    else w.hr.failNext(1);
    const result = await w.service.receipt(
      refill.id,
      refill.committedBy,
      receiptInput(),
    );
    assert.equal(result.refill.state, "PURCHASED");
    assert.equal((await w.service.empty("oslo")).existing, true);
    assert.equal((await w.store.getClaim(refill.id)).status, "PENDING_SUBMIT");
    await Promise.all([w.service.tick(), w.service.tick()]);
    assert.equal(w.hr.claims.size, 1);
    assert.equal(w.hr.calls.length, 2);
    assert.equal((await w.store.getClaim(refill.id)).attempts, 2);
    assert.equal((await w.store.getRefill(refill.id)).state, "CLAIM_SUBMITTED");
  }
});
test("HR approval reimburses; rejection notifies the buyer and admin once", async () => {
  for (const approved of [true, false]) {
    const w = world(),
      refill = await committed(w);
    await w.service.receipt(refill.id, refill.committedBy, receiptInput());
    const claim = await w.store.getClaim(refill.id);
    if (approved) w.hr.approve(claim.hrClaimId);
    else w.hr.reject(claim.hrClaimId);
    w.hr.failNext();
    await w.service.tick(); // A failed poll must keep the submitted claim for a later attempt.
    assert.equal((await w.store.getRefill(refill.id)).state, "CLAIM_SUBMITTED");
    await Promise.all([w.service.tick(), w.service.tick()]);
    assert.equal(
      (await w.store.getRefill(refill.id)).state,
      approved ? "REIMBURSED" : "CLAIM_REJECTED",
    );
    const notifications = w.chat.messages.filter((m) =>
      m.text.startsWith("HR rejected"),
    );
    assert.deepEqual(
      notifications.map((m) => m.type),
      approved ? [] : ["direct", "admin"],
    );
  }
});
