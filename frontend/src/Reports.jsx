import React from "react";
import { Empty, Icon, money } from "./ui.jsx";
export default function Reports({ data, month, setMonth }) {
  const report = data.report;
  return (
    <>
      <div className="report-toolbar">
        <div>
          <h2>Monthly spending</h2>
          <p className="muted">
            Purchases belong to each office’s local calendar month.
          </p>
        </div>
        <label>
          Report month
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </label>
      </div>
      <section className="report-hero">
        <div>
          <span className="eyebrow">BOTH OFFICES · ONE VIEW</span>
          <h2>{money(report.combinedMinor, "NOK")}</h2>
          <p>Combined counted spending</p>
        </div>
        <div className="rate-note">
          <Icon name="chart" size={32} />
          <strong>
            1 INR = {report.fxRate.numerator / report.fxRate.denominator} NOK
          </strong>
          <small>
            Illustrative fixed rate, stored with this report.
            <br />
            Used for reporting only. HR handles payroll FX.
          </small>
        </div>
      </section>
      <div className="report-offices">
        {data.offices.map((o) => {
          const totals = report.perOffice[o.id];
          return (
            <section className="panel" key={o.id}>
              <div className="panel-heading">
                <h2>{o.name}</h2>
                <span className={"office-mark " + o.id}>
                  {o.id === "oslo" ? "O" : "B"}
                </span>
              </div>
              <div className="report-amount">
                {money(totals.totalMinor, totals.currency)}
              </div>
              <p className="muted">
                {totals.refillCount} counted refill
                {totals.refillCount === 1 ? "" : "s"}
              </p>
              <div className="report-line">
                <span>Monthly budget</span>
                <strong>{money(o.monthlyBudget, o.currency)}</strong>
              </div>
              <div className="report-line">
                <span>Pending admin approval</span>
                <strong>
                  {money(totals.pendingApprovalMinor, o.currency)}
                </strong>
              </div>
            </section>
          );
        })}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">WHAT’S IN THE BOX?</p>
            <h2>Most purchased snacks</h2>
          </div>
          <Icon name="box" />
        </div>
        <p className="muted">
          Receipt quantities are a proxy for preferences, not a measure of
          consumption.
        </p>
        {report.topItems.length ? (
          <div className="snack-bars">
            {report.topItems.map((item, i) => (
              <div className="snack-row" key={item.name}>
                <span className="rank-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>{item.name}</strong>
                <div className="progress">
                  <i
                    style={{
                      width: (item.qty / report.topItems[0].qty) * 100 + "%",
                    }}
                  />
                </div>
                <span>{item.qty} units</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No purchases this month">
            Submit a receipt to start seeing snack preferences.
          </Empty>
        )}
      </section>
      <p className="report-footnote">
        Counted spend includes purchased, HR-submitted and reimbursed refills.
        Pending admin approvals are separate; declined and HR-rejected claims
        are excluded under the assignment rules. This is an operational report,
        not a cash-expense ledger.
      </p>
    </>
  );
}
