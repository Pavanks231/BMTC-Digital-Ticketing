# BMTC Digital Ticketing user guide

This guide covers the local Windows demo. It uses sample BMTC routes, a user-provided ordinary fare chart, and fictional student/conductor accounts. It does not connect to official BMTC systems or collect payments.

## Start the project

1. Start the MySQL Server service from Windows Services. MySQL Workbench is a database viewer; it does not start the database server.
2. Confirm `backend/.env` has the local database host, port, user, password, database name, and a JWT secret of at least 32 characters. The database name defaults to `bmtc_ticketing`.
3. Open PowerShell and run the backend setup and server:

   ```powershell
   cd "D:\Mini Project\BMTC-Digital-Ticketing\backend"
   npm.cmd install
   npm.cmd run db:setup
   npm.cmd run dev
   ```

   Keep this terminal open. `db:setup` creates or updates the schema and reapplies the fictional demo records. It hashes the demo passwords configured in `.env`.

4. Open a second PowerShell window and start the frontend:

   ```powershell
   cd "D:\Mini Project\BMTC-Digital-Ticketing\frontend"
   npm.cmd install
   npm.cmd run dev
   ```

5. Open the local URL printed by Vite, normally `http://localhost:5173`. The API health check is `http://127.0.0.1:5000/api/health`; it should report `ok` when the backend can reach MySQL.

## Demo accounts

- Students: `student001@example.test` through `student020@example.test`. All use `DEMO_STUDENT_PASSWORD` from `backend/.env`.
- Conductor: `conductor@example.test`. It uses `DEMO_CONDUCTOR_PASSWORD`, or the student demo password if the conductor variable is blank.

Passwords are stored in the database as bcrypt hashes, so their original values cannot be read from Workbench. The demo password values are in the local `.env` file. Changing a demo password there and running `npm.cmd run db:setup` updates the seeded account hashes.

## Student pass QR and conductor ticket flow

1. Sign in at `/passenger` with a seeded student account. The **Digital Student Pass** section shows the current pass QR and its route assignment. The student can display it on a phone or download/print it.
2. The sample student passes are assigned to route `1000`. This is demo data, not an official BMTC entitlement.
3. Sign in at `/conductor`. Select a downstream destination in **Student Pass QR** and scan the student's pass QR.
4. The backend checks the pass status, validity dates, passenger account, and route code against the conductor's active trip. If valid, it issues one zero-fare ticket for that pass holder. It rejects invalid, expired, wrong-route, or duplicate pass use on the same trip.
5. Give the student the issued ticket QR shown on the conductor page. It can be downloaded or printed and later scanned in the normal ticket-verification panel.

The pass QR carries only a random opaque pass ID. Student details and fare decisions remain on the server.

## View the database in MySQL Workbench

Create a local MySQL connection using the host, port, user, and password in `backend/.env`. After connecting, refresh the **Schemas** panel and expand `bmtc_ticketing` → **Tables**.

You can run these read-only queries in a SQL tab:

```sql
USE bmtc_ticketing;
SHOW TABLES;

SELECT full_name, email FROM passengers;
SELECT pass_number, route_code, valid_from, valid_until, status FROM student_passes;
```

`passengers.password_hash` and `conductors.password_hash` contain hashes, not recoverable plaintext passwords.

## Troubleshooting

- **The login page cannot connect:** make sure both PowerShell terminals are still running. The frontend is normally on port `5173`; the backend is on port `5000`.
- **The backend reports `database_unavailable`:** start MySQL Server and check `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` in `backend/.env`. Then run `npm.cmd run db:setup` from `backend/`.
- **Demo login is rejected:** use the email range above and the matching demo password from `.env`. If you changed that value, rerun `db:setup` so the seeded hash matches it.
- **Student pass QR is missing:** sign in with one of the seeded student accounts and rerun `db:setup` after confirming the database is available. The seeded pass must be verified, current, and assigned to route `1000`.
- **QR camera does not start:** allow camera access for the browser page and ensure a camera is available. On Windows, `npm.cmd` avoids the PowerShell `npm.ps1` execution-policy error.

## Run the available checks

From `backend/`:

```powershell
npm.cmd test
```

From `frontend/`:

```powershell
npm.cmd test
npm.cmd run build
```

The tests cover authentication input, fare calculation and route-bound pass eligibility, ticket creation and duplicate prevention, QR parsing, conductor verification, and seed data. A live MySQL migration and camera scan require the local MySQL service and browser hardware to be available.
