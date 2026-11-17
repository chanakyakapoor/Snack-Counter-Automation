import { config } from "./config.js";
import { createStore } from "./store.js";
import { fakeClock } from "./fakes/fakeClock.js";
import { fakeChat } from "./fakes/fakeChat.js";
import { fakeHr } from "./fakes/fakeHr.js";
import { createRefillService } from "./refillService.js";
import { createClaimService } from "./claimService.js";
import { createReportService } from "./reportService.js";

const employees = [
  ["ada", "Ada", "oslo", true, false],
  ["ben", "Ben", "oslo", true, false],
  ["chitra", "Chitra", "bengaluru", true, false],
  ["oslo-admin", "Oslo admin", "oslo", false, true],
  ["bengaluru-admin", "Bengaluru admin", "bengaluru", false, true],
].map(([employeeId, name, homeOffice, isVolunteer, isAdmin]) => ({
  employeeId,
  name,
  homeOffice,
  isVolunteer,
  isAdmin,
  payrollCurrency: config.offices[homeOffice].currency,
}));
let sequence = 0;
const deps = {
  config,
  store: createStore({ employees }),
  clock: fakeClock(),
  chat: fakeChat(),
  hr: fakeHr(),
  idGenerator: () => "demo-" + ++sequence,
};
const service = createRefillService(deps);
service.setClaimService(
  createClaimService({ ...deps, transition: service.transition }),
);
const reports = createReportService(deps);

for (const [officeId, amountMinor] of [
  ["oslo", 90_000],
  ["bengaluru", 200_000],
]) {
  const { refill } = await service.empty(officeId);
  console.log("\nEmpty:", config.offices[officeId].name, "→", refill.state);
  console.log("Offered to:", refill.offeredTo.join(", "));
  const results = await Promise.all(
    refill.offeredTo.map((id) => service.accept(refill.id, id)),
  );
  results.forEach((result, i) =>
    console.log(
      refill.offeredTo[i],
      result.ok ? "accepted → COMMITTED" : result.reason,
    ),
  );
  const buyer = results.find((r) => r.ok).refill.committedBy;
  const purchase = await service.receipt(refill.id, buyer, {
    amountMinor,
    receiptRef: "mock://" + officeId + ".png",
    items: [
      { name: "Nuts", qty: 4 },
      { name: "Fruit", qty: 6 },
    ],
  });
  console.log("Receipt →", purchase.refill.state);
  const claim = await deps.store.getClaim(refill.id);
  console.log(
    "HR claim:",
    claim.description,
    claim.amountMinor / 100,
    claim.currency,
    "buyer:",
    claim.employeeId,
  );
  deps.hr.approve(claim.hrClaimId);
  await service.tick();
  console.log("HR approved →", (await deps.store.getRefill(refill.id)).state);
}
console.log("\nOffice announcements:");
deps.chat.messages
  .filter((m) => m.type === "channel")
  .forEach((m) => console.log(m.officeId + ":", m.text));
console.log("\nMonthly report (minor units):");
console.log(JSON.stringify(await reports.monthlyReport("2026-11"), null, 2));
console.log(
  "Combined: 900 NOK + 2,000 INR × 1/8 = 1,150 NOK (illustrative fixed rate).",
);
