import React from "react";
import { money, date } from "./ui.jsx";
export default function Volunteers({ data, office, run, busy }) {
  const volunteers = data.employees.filter(
    (e) =>
      e.isVolunteer &&
      (e.homeOffice === office.id ||
        data.visits.some(
          (v) =>
            v.employeeId === e.employeeId &&
            v.officeId === office.id &&
            Date.parse(v.to) > data.now,
        )),
  );
  const other = data.offices.find((o) => o.id !== office.id);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SHARE THE EFFORT</p>
          <h2>{office.name} volunteers</h2>
        </div>
        <span className="badge neutral">{office.eligible.length} eligible</span>
      </div>
      <p className="muted">
        Lower unpaid exposure first, then fewer recent refills, then longest
        since the last refill. Availability is self-declared.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Volunteer</th>
              <th>Availability</th>
              <th>Unpaid in {office.currency}</th>
              <th>Eligible rank</th>
              <th>Demo actions</th>
            </tr>
          </thead>
          <tbody>
            {volunteers.map((e) => {
              const away = Date.parse(e.awayUntil) > data.now,
                rank = office.eligible.indexOf(e.employeeId);
              const visit = data.visits.find(
                (v) =>
                  v.employeeId === e.employeeId && Date.parse(v.to) > data.now,
              );
              return (
                <tr key={e.employeeId}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar">{e.name.slice(0, 2)}</span>
                      <div>
                        <strong>{e.name}</strong>
                        <small>
                          {e.homeOffice === office.id
                            ? "Home office"
                            : "Visiting from " + e.homeOffice}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        "badge " + (away ? "needs_approval" : "reimbursed")
                      }
                    >
                      {away ? "Away" : "Available"}
                    </span>
                    <small>
                      {away
                        ? "Until " + date(e.awayUntil, office.timezone)
                        : visit
                          ? "Visiting " +
                            visit.officeId +
                            " until " +
                            date(visit.to)
                          : "Self-declared"}
                    </small>
                  </td>
                  <td>
                    {money(e.exposure[office.currency], office.currency)}
                    <small>
                      Cap {money(office.exposureCap, office.currency)}
                    </small>
                  </td>
                  <td>{rank < 0 ? "Not eligible" : "#" + (rank + 1)}</td>
                  <td>
                    <div className="button-row">
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(
                            {
                              action: "availability",
                              employeeId: e.employeeId,
                              away: !away,
                            },
                            e.name +
                              (away
                                ? " is available again."
                                : " is away for 24 hours."),
                          )
                        }
                      >
                        {away ? "Mark available" : "Away for 24h"}
                      </button>
                      {visit ? (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              { action: "endVisit", employeeId: e.employeeId },
                              "Visit ended.",
                            )
                          }
                        >
                          End visit
                        </button>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              {
                                action: "visit",
                                employeeId: e.employeeId,
                                officeId: other.id,
                              },
                              e.name +
                                " is eligible to help in " +
                                other.name +
                                " for one week.",
                            )
                          }
                        >
                          Visit {other.name}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="panel-note">
        An active visitor can help in the visited office and buys in that
        office’s currency. HR handles payroll conversion.
      </p>
    </section>
  );
}
