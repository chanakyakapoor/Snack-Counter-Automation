import React from "react";
import { Badge, Empty, Icon, date, money } from "./ui.jsx";
import ReceiptForm from "./ReceiptForm.jsx";
const activeStates = ["OPEN", "COMMITTED", "PURCHASED", "NEEDS_APPROVAL"];
export default function Overview({ data, office, run, busy }) {
  const own = data.refills.filter((r) => r.officeId === office.id);
  const refill = own.find((r) => activeStates.includes(r.state));
  // Invitations are historical; availability can change before acceptance.
  const availableCandidates = (refill?.offeredTo ?? []).filter(
    (id) => office.eligible.includes(id) && !refill.excluded.includes(id),
  );
  const name = (id) =>
    data.employees.find((e) => e.employeeId === id)?.name || id;
  const pending = own.filter((r) =>
    ["CLAIM_SUBMITTED", "NEEDS_APPROVAL", "PURCHASED"].includes(r.state),
  );
  const messages = data.messages
    .filter(
      (m) =>
        m.officeId === office.id ||
        data.employees.some(
          (e) => e.employeeId === m.employeeId && e.homeOffice === office.id,
        ),
    )
    .slice(-6)
    .reverse();
  const progress = Math.max(
    0,
    Math.min(
      100,
      ((office.budget.spent + office.budget.reserved) / office.monthlyBudget) *
        100,
    ),
  );
  return (
    <>
      <div className="stats-grid">
        <div className="stat">
          <span>
            Available this month <Icon name="chart" />
          </span>
          <strong>{money(office.budget.remaining, office.currency)}</strong>
          <small>
            of {money(office.monthlyBudget, office.currency)} budget
          </small>
          <div className="progress">
            <i style={{ width: progress + "%" }} />
          </div>
        </div>
        <div className="stat">
          <span>
            Spent on snacks <Icon name="box" />
          </span>
          <strong>{money(office.budget.spent, office.currency)}</strong>
          <small>
            {office.budget.month} · {office.name} local month
          </small>
        </div>
        <div className="stat">
          <span>
            Reserved for shopping <Icon name="clock" />
          </span>
          <strong>{money(office.budget.reserved, office.currency)}</strong>
          <small>Released on receipt or handover</small>
        </div>
        <div className="stat">
          <span>
            Claims in progress <Icon name="people" />
          </span>
          <strong>{pending.length.toString().padStart(2, "0")}</strong>
          <small>Awaiting submission or approval</small>
        </div>
      </div>
      <div className="workspace-grid">
        <section className="panel refill-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">THE SNACK COUNTER</span>
              <h2>Next refill</h2>
            </div>
            {refill ? (
              <Badge state={refill.state} />
            ) : (
              <span className="badge neutral">No active request</span>
            )}
          </div>
          {!refill ? (
            <div className="ready-state">
              <div className="box-illustration">
                <Icon name="box" size={58} />
                <span className="spark one">✦</span>
                <span className="spark two">+</span>
              </div>
              <h3>A full counter starts with a little help.</h3>
              <p>
                Running low? Report an empty box and we’ll ask the next three
                eligible volunteers.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    { action: "empty", officeId: office.id },
                    "Refill requested. The top eligible volunteers have been offered the job.",
                  )
                }
              >
                <Icon name="box" /> Report empty box
              </button>
              <small>One request at a time. First acceptance wins.</small>
            </div>
          ) : (
            <>
              <div className="flow-steps">
                {["Report", "Accept", "Refill", "Reimburse"].map((step, i) => (
                  <div
                    key={step}
                    className={
                      i <=
                      (refill.state === "OPEN"
                        ? 0
                        : refill.state === "COMMITTED"
                          ? 1
                          : 2)
                        ? "done"
                        : ""
                    }
                  >
                    <span>{i + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
              <div className="refill-meta">
                <span>{refill.id}</span>
                <span>Opened {date(refill.openedAt, office.timezone)}</span>
              </div>
              {refill.escalatedAt != null && (
                <p className="callout">
                  The office admin has been notified that this refill needs
                  help.
                </p>
              )}
              {refill.state === "OPEN" && (
                <>
                  <p className="muted">
                    Offered to the next volunteers in the fair rotation. Accept
                    before {date(refill.offerExpiresAt, office.timezone)}.
                  </p>
                  <div className="candidate-list">
                    {availableCandidates.map((id) => (
                      <div className="candidate" key={id}>
                        <span className="avatar">{name(id).slice(0, 2)}</span>
                        <div>
                          <strong>{name(id)}</strong>
                          <small>
                            #{refill.offeredTo.indexOf(id) + 1} in this offer ·{" "}
                            {money(
                              data.employees.find((e) => e.employeeId === id)
                                .exposure[office.currency],
                              office.currency,
                            )}{" "}
                            owed
                          </small>
                        </div>
                        <button
                          disabled={busy || data.now >= refill.offerExpiresAt}
                          onClick={() =>
                            run(
                              {
                                action: "accept",
                                refillId: refill.id,
                                employeeId: id,
                              },
                              name(id) +
                                " accepted. The refill budget is reserved.",
                            )
                          }
                        >
                          Accept as {name(id)}
                        </button>
                      </div>
                    ))}
                  </div>
                  {!refill.offeredTo.length && (
                    <p className="callout">
                      Everyone eligible has already been asked. The admin should
                      coordinate the next purchase.
                    </p>
                  )}
                  {refill.offeredTo.length > 0 && !availableCandidates.length && (
                    <p className="callout">
                      No one in this offer is currently eligible. Away volunteers
                      and those at their unpaid exposure cap are hidden. The next
                      batch is offered when this offer expires and automation runs.
                    </p>
                  )}
                  <small className="muted">
                    Demo: buttons act as the named employee. Shopping starts
                    only after a successful acceptance.
                  </small>
                </>
              )}
              {refill.state === "COMMITTED" && (
                <>
                  <div className="buyer-banner">
                    <span className="avatar">
                      {name(refill.committedBy).slice(0, 2)}
                    </span>
                    <div>
                      <strong>{name(refill.committedBy)} is on it.</strong>
                      <small>
                        Receipt due{" "}
                        {date(refill.commitDeadline, office.timezone)}
                      </small>
                    </div>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          {
                            action: "withdraw",
                            refillId: refill.id,
                            employeeId: refill.committedBy,
                          },
                          "Reservation released. The next volunteers have been offered the refill.",
                        )
                      }
                    >
                      Can’t do it
                    </button>
                  </div>
                  <ReceiptForm
                    key={refill.id}
                    {...{ refill, office, run, busy }}
                  />
                </>
              )}
              {refill.state === "PURCHASED" && (
                <div className="callout">
                  <strong>Snacks refilled. The HR claim is pending.</strong>
                  <p>
                    The HR call failed. Run automation to retry safely with the
                    same claim key.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run({ action: "tick" }, "Pending claims retried.")
                    }
                  >
                    Retry HR claim
                  </button>
                </div>
              )}
              {refill.state === "NEEDS_APPROVAL" && (
                <div className="callout">
                  <strong>
                    {money(refill.purchase.amountMinor, office.currency)} needs
                    admin approval.
                  </strong>
                  <p>
                    The purchase is above the cap or available monthly budget.
                    No HR claim is submitted until it’s approved.
                  </p>
                  <small>
                    Review this receipt in the claims section below.
                  </small>
                </div>
              )}
            </>
          )}
          <div className="panel-note">
            <Icon name="check" /> Fairly assigned. Budget checked. Automatically
            claimed.
          </div>
        </section>
        <aside className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">KEEPING EVERYONE IN THE LOOP</span>
              <h2>Chat activity</h2>
            </div>
            <span className="count-pill">{messages.length}</span>
          </div>
          <p className="muted small-copy">
            Simulated direct messages and office updates.
          </p>
          {messages.length ? (
            <ol className="activity-list">
              {messages.map((message, i) => (
                <li key={i}>
                  <span className={"activity-dot " + message.type} />
                  <div>
                    <small>
                      {message.type === "direct"
                        ? "To " + name(message.employeeId)
                        : message.type === "admin"
                          ? "Office admin"
                          : office.name + " channel"}
                    </small>
                    <p>{message.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="Quiet for now">
              Report an empty box to see offers and updates arrive here.
            </Empty>
          )}
          <div className="activity-footer">
            <span className="status-dot" /> No real messages are sent
          </div>
        </aside>
      </div>
      <section className="panel claims-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">FROM RECEIPT TO REIMBURSEMENT</span>
            <h2>Claims & refill history</h2>
          </div>
          <span className="count-pill">
            {own.filter((r) => r.purchase).length}
          </span>
        </div>
        {!own.some((r) => r.purchase) ? (
          <div className="empty-inline">
            Your first receipt will appear here. HR claims are created
            automatically.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Volunteer / refill</th>
                  <th>Purchase</th>
                  <th>Status</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {own
                  .filter((r) => r.purchase)
                  .reverse()
                  .map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{name(r.committedBy)}</strong>
                        <small>
                          {r.id} ·{" "}
                          {date(r.purchase.purchasedAt, office.timezone)}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {money(r.purchase.amountMinor, r.purchase.currency)}
                        </strong>
                        <details>
                          <summary>Receipt & items</summary>
                          <ul>
                            {r.purchase.items.map((item, i) => (
                              <li key={i}>
                                {item.name} × {item.qty}
                              </li>
                            ))}
                          </ul>
                          {r.purchase.receiptRef.startsWith("data:image/") ? (
                            <img
                              className="receipt-preview"
                              src={r.purchase.receiptRef}
                              alt={"Receipt for " + r.id}
                            />
                          ) : (
                            <small>{r.purchase.receiptRef}</small>
                          )}
                        </details>
                      </td>
                      <td>
                        <Badge state={r.state} />
                      </td>
                      <td>
                        <div className="claim-actions">
                          {r.state === "NEEDS_APPROVAL" ? (
                            <>
                              <small>Act as {office.name} admin</small>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    {
                                      action: "decide",
                                      refillId: r.id,
                                      employeeId: office.id + "-admin",
                                      approved: true,
                                    },
                                    "Admin approved. The HR claim has been submitted.",
                                  )
                                }
                              >
                                Approve
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    {
                                      action: "decide",
                                      refillId: r.id,
                                      employeeId: office.id + "-admin",
                                      approved: false,
                                    },
                                    "Claim declined by the office admin.",
                                  )
                                }
                              >
                                Decline
                              </button>
                            </>
                          ) : r.state === "CLAIM_SUBMITTED" ? (
                            <>
                              <small>Simulate HR decision</small>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    {
                                      action: "hrDecision",
                                      refillId: r.id,
                                      approved: true,
                                    },
                                    "HR approved. The refill is marked reimbursed.",
                                  )
                                }
                              >
                                HR approve
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    {
                                      action: "hrDecision",
                                      refillId: r.id,
                                      approved: false,
                                    },
                                    "HR rejected. The volunteer and office admin were notified.",
                                  )
                                }
                              >
                                HR reject
                              </button>
                            </>
                          ) : (
                            <span className="muted">
                              {r.state === "REIMBURSED"
                                ? "All done ✓"
                                : r.state === "PURCHASED"
                                  ? "Retry with automation"
                                  : "Contact office admin"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
