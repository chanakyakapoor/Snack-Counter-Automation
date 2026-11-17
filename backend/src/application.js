import { config as defaults } from "./config.js";
import { createStore } from "./store.js";
import { fakeClock } from "./fakes/fakeClock.js";
import { fakeChat } from "./fakes/fakeChat.js";
import { fakeHr } from "./fakes/fakeHr.js";
import { createRefillService } from "./refillService.js";
import { createClaimService } from "./claimService.js";
import { createReportService } from "./reportService.js";
import { budget, monthOf } from "./budget.js";
import { exposure, selectVolunteers } from "./selection.js";

// One composition root: the browser and CLI exercise the same domain services.
export function createApplication(start = new Date().toISOString()) {
  const config = structuredClone(defaults);
  const names = {
    oslo: [
      "Ada",
      "Ben",
      "Freya",
      "Erik",
      "Ingrid",
      "Lars",
      "Nora",
      "Oskar",
      "Sofia",
      "Henrik",
      "Maja",
      "Emil",
      "Liv",
      "Jonas",
      "Astrid",
    ],
    bengaluru: [
      "Aarav",
      "Diya",
      "Ishaan",
      "Kavya",
      "Rohan",
      "Ananya",
      "Arjun",
      "Meera",
      "Vikram",
      "Priya",
      "Neha",
      "Dev",
      "Riya",
      "Kabir",
      "Nikhil",
      "Tara",
      "Rahul",
      "Sana",
      "Aditya",
      "Anika",
    ],
  };
  const employees = Object.entries(names).flatMap(([homeOffice, roster]) => [
    ...roster.map((name, i) => ({
      employeeId: homeOffice + "-" + String(i + 1).padStart(2, "0"),
      name,
      homeOffice,
      payrollCurrency: config.offices[homeOffice].currency,
      isVolunteer: true,
      isAdmin: false,
    })),
    {
      employeeId: homeOffice + "-admin",
      name: config.offices[homeOffice].name + " admin",
      homeOffice,
      payrollCurrency: config.offices[homeOffice].currency,
      isVolunteer: false,
      isAdmin: true,
    },
  ]);
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
    idGenerator: () => "ref-" + ++sequence,
  };
  const service = createRefillService(deps);
  service.setClaimService(
    createClaimService({ ...deps, transition: service.transition }),
  );
  const reports = createReportService(deps);

  async function snapshot(month = monthOf(clock.now(), "Europe/Oslo")) {
    const refills = await store.listRefills();
    const offices = Object.entries(config.offices).map(([id, office]) => ({
      id,
      ...office,
      budget: budget(refills, id, office, clock.now()),
      eligible: selectVolunteers({
        employees: store.employees,
        visits: store.visits,
        refills,
        officeId: id,
        office,
        now: clock.now(),
        historyWindow: config.historyWindow,
      }),
    }));
    const claims = (
      await Promise.all(refills.map((r) => store.getClaim(r.id)))
    ).filter(Boolean);
    return {
      now: clock.now(),
      offices,
      refills,
      claims,
      messages: chat.messages,
      visits: store.visits,
      report: await reports.monthlyReport(month),
      employees: store.employees.map((e) => ({
        ...e,
        exposure: {
          NOK: exposure(e.employeeId, "NOK", refills),
          INR: exposure(e.employeeId, "INR", refills),
        },
      })),
    };
  }
  return { ...deps, service, reports, snapshot };
}
