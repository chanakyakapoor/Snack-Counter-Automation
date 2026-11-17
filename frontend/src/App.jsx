import React, { useEffect, useState } from "react";
import { api, date, Icon } from "./ui.jsx";
import Overview from "./Overview.jsx";
import Volunteers from "./Volunteers.jsx";
import Reports from "./Reports.jsx";
const errors = {
  ALREADY_TAKEN:
    "Someone already accepted this refill. The latest status is shown below.",
  INSUFFICIENT_BUDGET:
    "The remaining budget cannot cover the refill cap. The office admin has been notified.",
  NOT_ELIGIBLE:
    "This person is unavailable or has reached their unpaid exposure cap.",
  OFFER_EXPIRED:
    "This offer expired. Run automation to ask the next volunteers.",
  NOT_OFFERED: "Only the volunteers in this offer can accept.",
  INVALID_RECEIPT:
    "Enter a positive amount, a receipt reference and at least one item with a whole-number quantity.",
  DEADLINE_PASSED:
    "The purchase deadline passed. Run automation to hand over the refill.",
};
export default function App() {
  const [data, setData] = useState(null),
    [officeId, setOffice] = useState("oslo");
  const [page, setPage] = useState("Overview"),
    [month, setMonth] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(null),
    [loadError, setLoadError] = useState(false),
    [confirmReset, setConfirmReset] = useState(false);
  const stateUrl = "/api/state" + (month ? "?month=" + month : "");
  async function refresh() {
    const next = await api(stateUrl);
    setData(next);
    setLoadError(false);
  }
  useEffect(() => {
    let active = true;
    api(stateUrl)
      .then((next) => {
        if (active) {
          setData(next);
          setLoadError(false);
        }
      })
      .catch((e) => {
        if (active) {
          setLoadError(true);
          setNotice({ error: true, text: e.message });
        }
      });
    return () => {
      active = false;
    };
  }, [stateUrl]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    setNotice(null);
  }, [page, officeId, month]);
  async function run(body, success = "Updated successfully.") {
    setBusy(true);
    setNotice(null);
    let ok = false;
    try {
      await api("/api/command", body);
      setNotice({ text: success });
      ok = true;
    } catch (e) {
      setNotice({
        error: true,
        text: errors[e.message] || e.message.replaceAll("_", " ").toLowerCase(),
      });
    } finally {
      try {
        await refresh();
      } catch {
        setNotice({
          error: true,
          text: "Cannot reach the backend. Start it with npm start, then refresh.",
        });
      }
      setBusy(false);
    }
    return ok;
  }
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  const office = data?.offices.find((o) => o.id === officeId);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Snack Counter home">
          <span className="brand-icon">
            <Icon name="box" size={26} />
          </span>
          <span>
            snack<span className="brand-light">counter</span>
            <small>A little care, shared.</small>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {["Overview", "Volunteers", "Reports"].map((name, i) => (
            <button
              key={name}
              className={"nav-button " + (page === name ? "selected" : "")}
              onClick={() => setPage(name)}
              aria-current={page === name ? "page" : undefined}
            >
              <Icon name={["grid", "people", "chart"][i]} />
              {name}
              {page === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="little-dot" /> TWO OFFICES. ONE TEAM.
          <p>
            Good snacks.
            <br />
            Fair shares.
            <br />
            Full counters.
          </p>
        </div>
        <div className="demo-label">
          <Icon name="box" />
          <div>
            Interview demo<small>In-memory · simulated chat & HR</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> <strong>{page}</strong>
          </span>
          <span className="topbar-right">
            <span className="status-dot" /> Local demo{" "}
            <span className="avatar small">SC</span>
          </span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">THE EVERYDAY, TAKEN CARE OF</p>
              <h1>
                {page === "Overview"
                  ? "Keep the good stuff stocked."
                  : page === "Volunteers"
                    ? "A little help from everyone."
                    : "Every refill, accounted for."}
              </h1>
              <p className="subtitle">
                {page === "Overview"
                  ? "Coordinate refills, share the effort, and keep your team fuelled."
                  : page === "Volunteers"
                    ? "Fair rotation starts with knowing who can help."
                    : "A clear view of spending across Oslo and Bengaluru."}
              </p>
            </div>
            <span className="heading-icon">
              <Icon name={page === "Reports" ? "chart" : "box"} size={40} />
            </span>
          </div>
          {notice && (
            <div
              role={notice.error ? "alert" : "status"}
              className={"toast " + (notice.error ? "error" : "")}
            >
              <span>{notice.text}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice(null)}
              >
                ×
              </button>
            </div>
          )}
          {!data ? (
            <div className="panel empty">
              <p>
                {loadError
                  ? "The dashboard could not load."
                  : "Loading your workspace…"}
              </p>
              <button
                onClick={() =>
                  refresh().catch((e) => {
                    setLoadError(true);
                    setNotice({ error: true, text: e.message });
                  })
                }
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {page !== "Reports" && (
                <div className="office-tabs" aria-label="Choose office">
                  {data.offices.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setOffice(o.id)}
                      className={officeId === o.id ? "active" : ""}
                      aria-pressed={officeId === o.id}
                    >
                      <span className={"office-mark " + o.id}>
                        {o.id === "oslo" ? "O" : "B"}
                      </span>
                      <span>
                        {o.name}
                        <small>
                          {o.currency} ·{" "}
                          {
                            data.employees.filter(
                              (e) => e.homeOffice === o.id && e.isVolunteer,
                            ).length
                          }{" "}
                          volunteers
                        </small>
                      </span>
                      <span className="office-arrow">↗</span>
                    </button>
                  ))}
                </div>
              )}
              {page === "Overview" && (
                <Overview {...{ data, office, run, busy }} />
              )}
              {page === "Volunteers" && (
                <Volunteers {...{ data, office, run, busy }} />
              )}
              {page === "Reports" && (
                <Reports
                  data={data}
                  month={month || data.report.month}
                  setMonth={setMonth}
                />
              )}
              <details className="demo-controls">
                <summary>
                  <Icon name="clock" /> Demo controls{" "}
                  <span>Fast-forward the story</span>
                </summary>
                <p>
                  The demo clock is paused. These controls run the same backend
                  rules used in the tests.
                </p>
                <div className="demo-time">Demo time: {date(data.now)} UTC</div>
                <fieldset disabled={busy}>
                  <div className="button-row">
                    <button
                      onClick={() =>
                        run(
                          { action: "tick" },
                          "Automation ran: deadlines checked, claims retried and HR status polled.",
                        )
                      }
                    >
                      <Icon name="refresh" /> Run automation
                    </button>
                    <button
                      onClick={() =>
                        run(
                          { action: "advance", hours: 4 },
                          "Advanced 4 hours and ran automation.",
                        )
                      }
                    >
                      +4 hours
                    </button>
                    <button
                      onClick={() =>
                        run(
                          { action: "advance", hours: 24 },
                          "Advanced 24 hours and ran automation.",
                        )
                      }
                    >
                      +24 hours
                    </button>
                    <button
                      onClick={() =>
                        run(
                          { action: "hrFailure", mode: "failure" },
                          "The next HR call will fail once. Submit a receipt, then run automation to retry.",
                        )
                      }
                    >
                      Fail next HR call
                    </button>
                    <button
                      onClick={() =>
                        run(
                          { action: "hrFailure", mode: "lostResponse" },
                          "The next HR submission will lose its response. Retrying will reuse the same claim.",
                        )
                      }
                    >
                      Lose HR response
                    </button>
                    <button
                      className="danger-quiet"
                      onClick={() => setConfirmReset(!confirmReset)}
                    >
                      Reset demo
                    </button>
                  </div>
                  {confirmReset && (
                    <div className="reset-confirm">
                      Clear all demo purchases, claims and roster changes?{" "}
                      <button
                        onClick={async () => {
                          if (
                            await run(
                              { action: "reset" },
                              "Demo reset to an empty workspace.",
                            )
                          ) {
                            setConfirmReset(false);
                            setMonth("");
                          }
                        }}
                      >
                        Yes, reset
                      </button>
                      <button onClick={() => setConfirmReset(false)}>
                        Keep data
                      </button>
                    </div>
                  )}
                </fieldset>
              </details>
              <footer>
                Made for the team, shared by the team.
                <span>Node.js + React · No real messages or payments</span>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
