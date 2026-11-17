# Snack Counter Automation

A Node.js and React application for coordinating snack refills and reimbursement
across offices in Oslo and Bengaluru.

## Features

- One confirmed buyer per active refill, including simultaneous acceptance attempts.
- Volunteer selection based on availability, office visits, unpaid amounts and
  refill history. Unanswered offers and missed commitments trigger reassignment.
- Separate NOK and INR budgets, reservations before shopping, and admin review
  for receipts above spending limits.
- Automatic HR claim submission with safe retries, status tracking and rejection
  notifications.
- Monthly spending by office, a combined NOK report, and quantities of snacks purchased.

## Run locally

Requires **Node.js 20+** and npm. From the project root:

```sh
npm ci
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000). The backend serves both the
API and the built React app. Rebuild after frontend changes when using this mode.

For frontend development, keep the backend running and use another terminal:

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite reloads frontend changes
and forwards API requests to the backend on port 3000.

## Try the workflow

1. In **Overview**, choose an office and report an empty box.
2. Accept as an offered volunteer, then submit an amount and item quantities,
   optionally attaching a receipt image. A claim is created automatically unless
   admin approval is required.
3. Use **HR approve** in the claim history to simulate reimbursement, then check
   **Reports** for spending and purchased items.

**Volunteers** manages availability and office visits. **Demo controls** advance
time and simulate HR failures or lost responses so reassignment and retries can
be exercised without waiting.

## Tests and CLI demo

```sh
npm test
npm run demo
```

Tests cover concurrent acceptance, eligibility, handover, budgets, currency
handling, claim retries and monthly reports using Node's built-in test runner.
The CLI runs a separate end-to-end scenario. Neither requires external services.

## Project structure

| Directory | Contents |
| --- | --- |
| `frontend/` | React UI and Vite configuration |
| `backend/src/` | HTTP API, business rules, in-memory store and simulated integrations |
| `backend/test/` | Domain and HTTP integration tests |

## Scope and limitations

- Data is stored in memory and resets when the backend restarts.
- Chat and HR are simulated. Actor buttons demonstrate the workflow; there is
  no authentication or real payment integration. HR approval represents reimbursement.
- The demo clock is paused. Timed checks and retries run through demo controls;
  there is no background scheduler.
- Snack quantities measure purchases, not actual consumption.
- Combined reporting uses a fixed illustrative exchange rate. Pending approvals
  are shown separately; denied and HR-rejected claims are excluded from counted
  spending, so the report is not a complete cash ledger.
