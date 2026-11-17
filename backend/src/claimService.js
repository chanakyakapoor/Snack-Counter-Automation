import { monthOf } from "./budget.js";
import { messages } from "./refillService.js";

/** All refill writes use the lifecycle's CAS, including competing HR retry/poll calls. */
export function createClaimService({
  store,
  hr,
  chat,
  config,
  idGenerator,
  transition,
}) {
  async function submit(refillId) {
    let refill = await store.getRefill(refillId);
    if (refill?.state !== "PURCHASED" || refill.claimBusy) return;
    refill = await transition(refill, refill.version, { claimBusy: true });
    if (!refill) return;
    const office = config.offices[refill.officeId],
      purchase = refill.purchase;
    const claim = (await store.getClaim(refillId)) ?? {
      id: idGenerator(),
      refillId,
      employeeId: refill.committedBy,
      amountMinor: purchase.amountMinor,
      currency: purchase.currency,
      description:
        "Snack refill – " +
        office.name +
        " – " +
        monthOf(purchase.purchasedAt, office.timezone),
      receiptRef: purchase.receiptRef,
      status: "PENDING_SUBMIT",
      attempts: 0,
    };
    claim.attempts += 1;
    await store.saveClaim(claim);
    let remote;
    try {
      // Stable key prevents charging HR twice when it succeeded but the response was lost.
      remote = await hr.createClaim(refillId, {
        amountMinor: claim.amountMinor,
        currency: claim.currency,
        description: claim.description,
        receiptRef: claim.receiptRef,
        employeeId: claim.employeeId,
      });
    } catch {
      await transition(refill, refill.version, { claimBusy: false });
      return; // Keep PURCHASED and PENDING_SUBMIT; the next tick retries.
    }
    await store.saveClaim({
      ...claim,
      hrClaimId: remote.id,
      status: "SUBMITTED",
    });
    await transition(refill, refill.version, {
      state: "CLAIM_SUBMITTED",
      claimId: claim.id,
      claimBusy: false,
    });
  }
  async function poll(refillId) {
    let refill = await store.getRefill(refillId);
    if (refill?.state !== "CLAIM_SUBMITTED" || refill.claimBusy) return;
    refill = await transition(refill, refill.version, { claimBusy: true });
    if (!refill) return;
    const claim = await store.getClaim(refillId);
    let status;
    try {
      status = await hr.getStatus(claim.hrClaimId);
    } catch {
      await transition(refill, refill.version, { claimBusy: false });
      return;
    }
    if (!["APPROVED", "REJECTED"].includes(status)) {
      await transition(refill, refill.version, { claimBusy: false });
      return;
    }
    await store.saveClaim({ ...claim, status });
    const next = await transition(refill, refill.version, {
      state: status === "APPROVED" ? "REIMBURSED" : "CLAIM_REJECTED",
      claimBusy: false,
    });
    if (next && status === "REJECTED") {
      chat.direct(refill.committedBy, messages.rejected);
      chat.admin(refill.officeId, messages.rejected);
    }
  }
  async function tick() {
    for (const refill of await store.listRefills()) {
      if (refill.state === "PURCHASED") await submit(refill.id);
      else if (refill.state === "CLAIM_SUBMITTED") await poll(refill.id);
    }
  }
  return { submit, poll, tick };
}
