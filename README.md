# BMTC Digital Ticketing

A college mini project for digital bus ticket booking and QR ticket verification.

## Current progress

**Phases 1-11** are implemented: frontend navigation, passenger and conductor authentication, a bus/route/stop catalog, static bus QR identification, conductor current-stop updates, passenger fare estimates and server-issued demo tickets, conductor QR verification with one-time use and history, route-checked student-pass QR ticketing, final automated checks, and operating documentation. The Express/MySQL API uses password hashes and role-specific HttpOnly session cookies. Demo data includes 200 route codes with direction/stop data, 20 fictional student-pass accounts for route 1000, one fictional conductor, and one sample bus trip.

## Run the frontend

From the `frontend` directory in PowerShell:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. Use `npm.cmd run build` to create a production build. On this Windows setup, call `npm.cmd`; PowerShell currently blocks the `npm.ps1` script shim.

## Project structure

```text
AGENTS.md
README.md
frontend/
  src/
    components/   Shared header and footer
    pages/        Home, passenger, conductor, routes/stops catalog, and not-found pages
    App.jsx       Routes
    main.jsx      React entry point
    styles.css    Responsive visual styles
  index.html
  package.json
  vite.config.js
```

The backend API is in `backend/`. Database setup and seed instructions are in `backend/database/README.md`. The supplied ordinary-service fare chart is stored as a user-provided schedule. For a demo fare estimate, three traveled stop intervals count as one 2 km stage; this is the route-distance assumption you supplied, not measured distance data.

For step-by-step startup, demo login, student QR ticketing, Workbench access, and troubleshooting, see [the user guide](docs/USER_GUIDE.md).

For a temporary public demo link or a stable hosted URL, see [the deployment guide](docs/DEPLOYMENT.md).

## Run the project locally

1. In PowerShell, copy `backend/.env.example` to `backend/.env`, then set your local MySQL password and a random JWT secret.
2. Start the MySQL service.
3. In `backend/`, run `npm.cmd install`, then `npm.cmd run db:setup`, then `npm.cmd run dev`.
4. In a second PowerShell window, in `frontend/`, run `npm.cmd install`, then `npm.cmd run dev`.

The student accounts use the test-only password set in `DEMO_STUDENT_PASSWORD` in `backend/.env`. Sign in to the conductor portal with `conductor@example.test`; use `DEMO_CONDUCTOR_PASSWORD` from `backend/.env`, or the student demo password if it is unset. The dashboard shows the sample trip on route 1000 Outbound. All demo accounts and the bus are fictional; they are not official BMTC records.

The Routes page searches the seeded bus register and route catalog, including direction metadata and ordered stops. It displays and downloads each bus's static QR code. The passenger portal scans that code and asks the backend to confirm the active trip and current boarding stop. The conductor dashboard can update the current stop for its assigned trip, and passengers then see that stop after scanning the bus QR. Passengers can choose a later stop and request an estimate; the backend loads the fare rates and checks current student-pass eligibility. Confirming creates a database ticket from a fresh server-side calculation. The passenger can display its QR code and review recent tickets in account history. The ticket QR contains only a random ticket identifier; fare and passenger details remain server-side. Payment processing is not integrated, so positive-fare tickets are demo tickets and no payment is collected. Conductors can scan tickets for their active trip; each valid ticket is accepted once, and all valid-format attempts are recorded in conductor history. A student can show or print their digital pass QR; the conductor selects the destination and scans it to verify the pass route and issue one individual zero-fare ticket.

Run `npm.cmd test` from both `backend/` and `frontend/`; run `npm.cmd run build` from `frontend/`. The latest Phase 11 check passed 49 backend tests, 7 frontend tests, and the production build. Live database migration checks still require MySQL Server to be running.
