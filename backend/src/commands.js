const fail = (reason) => ({ ok: false, reason });
const day = 86_400_000;

// Demo controls are explicit; real integrations would supply verified identities and HR events.
export async function command(app, body) {
  const { service, store, clock, hr } = app;
  const { action, refillId, employeeId, officeId } = body;
  switch (action) {
    case "empty":
      return Object.hasOwn(app.config.offices, officeId)
        ? service.empty(officeId)
        : fail("UNKNOWN_OFFICE");
    case "accept":
      return service.accept(refillId, employeeId);
    case "withdraw":
      return service.withdraw(refillId, employeeId);
    case "receipt":
      return service.receipt(refillId, employeeId, body.receipt);
    case "decide":
      return service.decide(refillId, employeeId, body.approved);
    case "tick":
      await service.tick();
      return { ok: true };
    case "advance":
      if (![4, 24].includes(body.hours)) return fail("INVALID_HOURS");
      clock.advance(body.hours * 3_600_000);
      await service.tick();
      return { ok: true };
    case "hrFailure":
      if (!["failure", "lostResponse"].includes(body.mode))
        return fail("INVALID_MODE");
      if (body.mode === "failure") hr.failNext();
      else hr.loseNextResponse();
      return { ok: true };
    case "hrDecision": {
      const claim = await store.getClaim(refillId);
      const refill = await store.getRefill(refillId);
      if (!claim?.hrClaimId || refill?.state !== "CLAIM_SUBMITTED")
        return fail("NOT_SUBMITTED");
      if (typeof body.approved !== "boolean") return fail("INVALID_DECISION");
      if (body.approved) hr.approve(claim.hrClaimId);
      else hr.reject(claim.hrClaimId);
      await service.tick();
      return { ok: true };
    }
    case "availability": {
      const employee = store.employees.find(
        (e) => e.employeeId === employeeId && e.isVolunteer,
      );
      if (!employee) return fail("UNKNOWN_EMPLOYEE");
      if (typeof body.away !== "boolean") return fail("INVALID_AVAILABILITY");
      employee.awayUntil = body.away
        ? new Date(clock.now() + day).toISOString()
        : null;
      return { ok: true };
    }
    case "visit": {
      const employee = store.employees.find(
        (e) => e.employeeId === employeeId && e.isVolunteer,
      );
      if (
        !employee ||
        !Object.hasOwn(app.config.offices, officeId) ||
        employee.homeOffice === officeId
      )
        return fail("INVALID_VISIT");
      store.visits = store.visits.filter((v) => v.employeeId !== employeeId);
      store.visits.push({
        employeeId,
        officeId,
        from: new Date(clock.now()).toISOString(),
        to: new Date(clock.now() + 7 * day).toISOString(),
      });
      return { ok: true };
    }
    case "endVisit":
      store.visits = store.visits.filter((v) => v.employeeId !== employeeId);
      return { ok: true };
    default:
      return fail("UNKNOWN_ACTION");
  }
}
