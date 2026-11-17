import { config as defaults } from "../src/config.js";
import { createStore } from "../src/store.js";
import { createRefillService } from "../src/refillService.js";
import { fakeChat } from "../src/fakes/fakeChat.js";
import { fakeClock } from "../src/fakes/fakeClock.js";
import { fakeHr } from "../src/fakes/fakeHr.js";
import { createClaimService } from "../src/claimService.js";

export function world(start) {
  const config = structuredClone(defaults),
    employees = [];
  for (const office of Object.keys(config.offices)) {
    for (let i = 1; i <= 9; i++)
      employees.push({
        employeeId: office + i,
        name: office + " volunteer " + i,
        homeOffice: office,
        payrollCurrency: config.offices[office].currency,
        isVolunteer: true,
        isAdmin: false,
      });
    employees.push({
      employeeId: office + "-admin",
      name: office + " admin",
      homeOffice: office,
      isVolunteer: false,
      isAdmin: true,
    });
  }
  const store = createStore({ employees }),
    clock = fakeClock(start),
    chat = fakeChat(),
    hr = fakeHr();
  let sequence = 0;
  const deps = {
    config,
    store,
    clock,
    chat,
    hr,
    idGenerator: () => "id-" + ++sequence,
  };
  const service = createRefillService(deps);
  const claims = createClaimService({
    ...deps,
    transition: service.transition,
  });
  service.setClaimService(claims);
  return { ...deps, service, claims };
}
export async function committed(w, officeId = "oslo") {
  const { refill } = await w.service.empty(officeId);
  return (await w.service.accept(refill.id, refill.offeredTo[0])).refill;
}
export const receiptInput = (amountMinor = 90_000) => ({
  amountMinor,
  receiptRef: "mock://receipt.png",
  items: [{ name: "Nuts", qty: 2 }],
});
