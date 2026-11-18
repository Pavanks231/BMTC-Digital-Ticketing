# BMTC Digital Ticketing project notes

## Project direction

Build this college mini project incrementally, one module at a time. Inspect existing files before editing, keep working code intact, and explain meaningful changes. Keep the React frontend, Express backend, and MySQL database responsibilities separate.

## Product and security rules

- Treat fares and concession eligibility as backend decisions. The frontend may display results, but it must not calculate or authorize a fare.
- Validate every value received by the backend. Hash passwords with bcryptjs and keep JWT secrets and database credentials in an ignored local `.env` file.
- Never put passenger personal information or a trusted fare amount in a QR code. Passenger ticket QR codes should identify a server-side ticket that can be verified once.
- Student pass QR codes should contain only an opaque server-side pass ID; verify pass status, dates, and assigned route against the conductor's active trip before issuing a ticket.
- Do not grant student concessions until a valid student pass has been verified. Treat sample routes and fares as demo data until verified BMTC information is available.
- Keep an assisted conductor booking path in scope for students without smartphones.

## Project progress

- Phase 1: React/Vite landing page and passenger/conductor navigation are implemented in `frontend/`.
- Phase 2: passenger registration/login, 200 route codes with direction/stop data, 20 synthetic student-pass accounts, and the user-supplied fare schedule are implemented.
- Phase 3: conductor login, hashed demo conductor account, assigned sample bus/trip, and a protected dashboard with ordered route stops are implemented.
- Phase 4: bus register and route/stop catalog are available through `GET /api/transit/buses`, `GET /api/transit/routes`, and the route-direction detail endpoint. The React Routes page searches routes/stops and presents ordered route details.
- Phase 5: each active bus displays a downloadable static QR identifier; signed-in passengers can scan it, and the backend resolves the bus's active trip and current boarding stop.
- Phase 6: conductors can set the current stop from their assigned trip's ordered stops; the passenger bus lookup reflects that updated boarding stop.
- Phase 7: passengers can choose a downstream destination and request a fare estimate; the backend derives trip, stop, fare schedule, and student-pass eligibility from the database.
- Phase 8: passengers can confirm a booking, create a server-priced ticket, view ticket history, and display/download an opaque ticket QR identifier.
- Phase 9: conductors scan ticket QRs; the backend checks the conductor's active trip, atomically marks a matching valid ticket used, rejects duplicates, and records verification history.
- Phase 10: students can show or print an opaque student-pass QR; conductors scan it and the backend checks the active pass and route code before issuing one free individual ticket.
- Phase 11: backend/frontend test suites, frontend production build, user startup/login/database guide, and final known-limitations documentation are complete. A live database migration still needs MySQL Server to be running on the local machine.
- Deployment preparation: Express serves the production Vite build from a single origin; a Dockerfile and deployment guide cover a temporary demo tunnel and a hosted MySQL-backed Railway service. External publication still requires a user-controlled GitHub/hosting account.

## Windows development

Use `npm.cmd` from PowerShell on this machine because its execution policy blocks the `npm.ps1` shim. Run the relevant build or module checks before advancing to the next phase. Keep local dependencies, build output, and environment files out of source control.
