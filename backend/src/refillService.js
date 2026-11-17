import { activeStates } from "./store.js";
import { selectVolunteers } from "./selection.js";
import { budget } from "./budget.js";

// Keep chat wording together so adapters can replace it without changing business rules.
export const messages = {
  offer: (id) =>
    "Please accept snack refill " +
    id +
    " within 4 hours; buy only after acceptance.",
  taken: "Already taken by another volunteer.",
  committed:
    "You accepted. Please refill and submit the receipt within 24 hours.",
  handover:
    "Your commitment ended. Do not buy; the refill is being reassigned.",
  escalation:
    "Snack refill needs help: no candidates remain or it has been open over 24 hours.",
  budget: "Not enough unreserved monthly budget for this refill.",
  approval:
    "Receipt exceeds the cap or monthly budget. Please approve or deny.",
  refilled: (name) => "Box refilled by " + name + ", thank you",
  denied: "The office admin declined this claim; please contact them.",
  rejected: "HR rejected the snack claim; please contact the office admin.",
};
const fail = (reason) => ({ ok: false, reason });

export function createRefillService({
  store,
  chat,
  clock,
  idGenerator,
  config,
}) {
  let claims;
  const officeFor = (id) => config.offices[id];
  async function transition(refill, expectedVersion, patch) {
    const next = { ...refill, ...patch, version: (expectedVersion ?? -1) + 1 };
    return (await store.compareAndSet(refill.id, expectedVersion, next))
      ? next
      : null;
  }
  async function ranked(refill, excluded = refill.excluded) {
    return selectVolunteers({
      employees: store.employees,
      visits: store.visits,
      refills: await store.listRefills(),
      officeId: refill.officeId,
      office: officeFor(refill.officeId),
      now: clock.now(),
      excluded,
      historyWindow: config.historyWindow,
    });
  }
  async function offer(refill) {
    const offeredTo = (
      await ranked(refill, [...refill.excluded, ...refill.offeredHistory])
    ).slice(0, 3);
    const escalate =
      refill.escalatedAt == null &&
      (!offeredTo.length ||
        clock.now() - refill.openedAt > config.escalationWindow);
    const next = await transition(refill, refill.version, {
      offeredTo,
      offeredHistory: [...refill.offeredHistory, ...offeredTo],
      offerExpiresAt: clock.now() + config.offerWindow,
      ...(escalate ? { escalatedAt: clock.now() } : {}),
    });
    if (next) {
      offeredTo.forEach((id) => chat.direct(id, messages.offer(next.id)));
      if (escalate) chat.admin(next.officeId, messages.escalation);
    }
    return next;
  }
  async function empty(officeId) {
    if (!officeFor(officeId)) return fail("UNKNOWN_OFFICE");
    const existing = (await store.listRefills()).find(
      (r) => r.officeId === officeId && activeStates.has(r.state),
    );
    if (existing) return { ok: true, existing: true, refill: existing };
    const refill = await transition({ id: idGenerator(), officeId }, null, {
      state: "OPEN",
      openedAt: clock.now(),
      offeredTo: [],
      offeredHistory: [],
      excluded: [],
      reservedMinor: 0,
    });
    if (!refill) return empty(officeId); // A simultaneous /empty won the store's uniqueness check.
    return {
      ok: true,
      existing: false,
      refill: (await offer(refill)) ?? (await store.getRefill(refill.id)),
    };
  }
  async function accept(id, employeeId) {
    const refill = await store.getRefill(id);
    if (!refill) return fail("NOT_FOUND");
    if (refill.state !== "OPEN") {
      chat.direct(employeeId, messages.taken);
      return fail("ALREADY_TAKEN");
    }
    if (!refill.offeredTo.includes(employeeId)) return fail("NOT_OFFERED");
    if (clock.now() >= refill.offerExpiresAt) return fail("OFFER_EXPIRED");
    if (!(await ranked(refill)).includes(employeeId))
      return fail("NOT_ELIGIBLE");
    const office = officeFor(refill.officeId);
    if (
      budget(await store.listRefills(), refill.officeId, office, clock.now())
        .remaining < office.refillCap
    ) {
      chat.admin(refill.officeId, messages.budget);
      return fail("INSUFFICIENT_BUDGET");
    }
    const next = await transition(refill, refill.version, {
      state: "COMMITTED",
      committedBy: employeeId,
      commitDeadline: clock.now() + config.buyWindow,
      reservedMinor: office.refillCap,
    });
    if (!next) {
      chat.direct(employeeId, messages.taken);
      return fail("ALREADY_TAKEN");
    }
    chat.direct(employeeId, messages.committed);
    return { ok: true, refill: next };
  }
  async function handover(refill) {
    const next = await transition(refill, refill.version, {
      state: "OPEN",
      reservedMinor: 0,
      excluded: [...refill.excluded, refill.committedBy],
      committedBy: null,
      commitDeadline: null,
    });
    if (!next) return fail("CONFLICT");
    chat.direct(refill.committedBy, messages.handover);
    return {
      ok: true,
      refill: (await offer(next)) ?? (await store.getRefill(next.id)),
    };
  }
  async function withdraw(id, employeeId) {
    const refill = await store.getRefill(id);
    if (!refill) return fail("NOT_FOUND");
    if (refill.state !== "COMMITTED" || refill.committedBy !== employeeId)
      return fail("NOT_COMMITTED");
    return handover(refill);
  }
  async function receipt(id, employeeId, input) {
    const refill = await store.getRefill(id);
    if (!refill) return fail("NOT_FOUND");
    if (refill.state !== "COMMITTED" || refill.committedBy !== employeeId)
      return fail("NOT_COMMITTED");
    if (clock.now() >= refill.commitDeadline) return fail("DEADLINE_PASSED");
    const office = officeFor(refill.officeId);
    if (
      !input ||
      !Number.isSafeInteger(input.amountMinor) ||
      input.amountMinor <= 0 ||
      (input.currency && input.currency !== office.currency) ||
      typeof input.receiptRef !== "string" ||
      !input.receiptRef.trim() ||
      !Array.isArray(input.items) ||
      !input.items.length ||
      input.items.some(
        (item) =>
          !item ||
          typeof item.name !== "string" ||
          !item.name.trim() ||
          !Number.isSafeInteger(item.qty) ||
          item.qty <= 0,
      )
    )
      return fail("INVALID_RECEIPT");
    const ledger = budget(
      await store.listRefills(),
      refill.officeId,
      office,
      clock.now(),
    );
    const needsApproval =
      input.amountMinor > office.refillCap ||
      ledger.spent + input.amountMinor > office.monthlyBudget;
    const next = await transition(refill, refill.version, {
      state: needsApproval ? "NEEDS_APPROVAL" : "PURCHASED",
      reservedMinor: 0,
      purchase: {
        amountMinor: input.amountMinor,
        currency: office.currency,
        purchasedAt: clock.now(),
        receiptRef: input.receiptRef,
        items: input.items.map((i) => ({ name: i.name.trim(), qty: i.qty })),
      },
    });
    if (!next) return fail("CONFLICT");
    const employee = store.employees.find((e) => e.employeeId === employeeId);
    chat.channel(refill.officeId, messages.refilled(employee.name));
    if (needsApproval)
      chat.admin(refill.officeId, messages.approval, [
        { action: "approve", refillId: id },
        { action: "deny", refillId: id },
      ]);
    else if (claims) await claims.submit(id);
    return { ok: true, refill: await store.getRefill(id) };
  }
  async function decide(id, adminId, approved) {
    const refill = await store.getRefill(id);
    if (!refill) return fail("NOT_FOUND");
    if (
      !store.employees.some(
        (e) =>
          e.employeeId === adminId &&
          e.isAdmin &&
          e.homeOffice === refill.officeId,
      )
    )
      return fail("NOT_ADMIN");
    if (typeof approved !== "boolean") return fail("INVALID_DECISION");
    if (refill.state !== "NEEDS_APPROVAL") return fail("NOT_PENDING_APPROVAL");
    const next = await transition(refill, refill.version, {
      state: approved ? "PURCHASED" : "CANCELLED",
    });
    if (!next) return fail("CONFLICT");
    if (approved && claims) await claims.submit(id);
    if (!approved) chat.direct(refill.committedBy, messages.denied);
    return { ok: true, refill: await store.getRefill(id) };
  }
  async function tick() {
    for (const refill of await store.listRefills()) {
      if (refill.state === "COMMITTED" && clock.now() >= refill.commitDeadline)
        await handover(refill);
      else if (refill.state === "OPEN") {
        if (clock.now() >= refill.offerExpiresAt) await offer(refill);
        else if (
          refill.escalatedAt == null &&
          clock.now() - refill.openedAt > config.escalationWindow
        ) {
          if (
            await transition(refill, refill.version, {
              escalatedAt: clock.now(),
            })
          )
            chat.admin(refill.officeId, messages.escalation);
        }
      }
    }
    if (claims) await claims.tick();
  }
  return {
    empty,
    accept,
    withdraw,
    receipt,
    decide,
    tick,
    transition,
    setClaimService(service) {
      claims = service;
    },
  };
}
