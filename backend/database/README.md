# Database setup and sample data

The schema uses `bmtc_ticketing` and separates passenger accounts, student passes, conductors, buses, trips, routes, stops, route directions, and ordered route stops. `npm.cmd run db:setup` creates the schema and imports the included seed data in a transaction. Run it from the `backend/` directory after configuring `backend/.env` and starting MySQL.

The transit catalog exposes active buses, searchable active routes, route directions, schedule metadata, and ordered stops through read-only API endpoints. The workbook remains the imported reference for route order; stop-to-stop distances are only returned when present in the source data.

Active bus entries expose a static QR value in the form `bmtc://bus/<registration-number>`. It identifies the bus only. The passenger scanner sends that identifier to the backend, which returns an active trip and the trip's current stop when one is running. No passenger details or fare are encoded in the bus QR.

The conductor can update a running assigned trip with `PATCH /api/conductor/trips/current-stop`. The server verifies the stop sequence belongs to the assigned route before updating `trips.current_stop_sequence` and `current_stop_updated_at`; the bus QR lookup then returns the latest boarding stop.

Signed-in passengers can request a fare estimate with `POST /api/transit/buses/:registrationNumber/fare-quote`, sending only a destination stop sequence and passenger category counts. The server loads the running trip's current stop, checks that the destination is later on the same route, reads the active ordinary fare rates, and checks that the signed-in passenger has a current verified pass assigned to that route code. Client fare amounts, distance, and pass claims are ignored. Boarding lookup returns the downstream stops available for selection.

Phase 8 adds `tickets` and `ticket_passenger_counts`. `POST /api/tickets` accepts the bus, destination sequence, and category counts, recalculates the fare on the server inside a transaction, and creates a random UUID ticket identifier. A `bmtc://ticket/<uuid>` QR carries only that identifier. `GET /api/tickets` returns the signed-in passenger's latest 50 tickets, and `GET /api/tickets/:publicId` returns one ticket only to its owner.

Payment processing is not connected. Tickets with a positive fare are marked `not_integrated` and clearly labeled as prototype tickets; no payment is collected. A zero-fare ticket covered by a verified pass is marked `not_required`.

Phase 9 adds `ticket_verifications`. `POST /api/conductor/tickets/verify` accepts a UUID read from the passenger QR, requires conductor authentication and an active assigned trip, and uses a transaction plus a conditional `valid` to `used` update so a ticket can be accepted only once. Wrong-trip, already-used, invalid, not-found, and no-active-trip outcomes are recorded without consuming the ticket. `GET /api/conductor/tickets/verification-history` returns the conductor's latest 50 attempts and never includes passenger names or account details. Run `npm.cmd run db:setup` from `backend/` after starting MySQL to add the verification-history table to an existing database.

Phase 10 adds an opaque `pass_public_id` and an authorized `route_code` to each student pass. `GET /api/student-passes/current` returns the signed-in student's current verified pass and a `bmtc://student-pass/<uuid>` QR value; the QR contains no pass number or personal details. Demo passes are assigned to route `1000`. The conductor selects a destination and scans the pass QR; `POST /api/conductor/tickets/assisted` accepts only the opaque pass ID and destination sequence. The backend checks that the pass is verified, current, active, and assigned to the same route as the conductor's running trip, recalculates the fare, and creates one ticket for the pass holder. The unique trip/pass index prevents a second free ticket for the same pass on the trip. Run `npm.cmd run db:setup` from `backend/` after starting MySQL; setup applies the pass QR/route and ticket migrations to an existing database and re-runs the idempotent seeds. A pass with no assigned route cannot be used until an administrator assigns one.

## Route import

The supplied workbook contains 4,416 unique route codes across 7,475 direction-specific rows. The project seed selects the first 200 unique route codes in source order (`1000` through `1292`) and retains every direction and stop sequence for those codes: 365 direction records and 1,411 distinct stop names. The selected records have complete descriptions and stop lists, and their stop counts match the workbook. Route trip counts and first/last trip times are retained as source metadata. The workbook does not supply fares or stop-to-stop distance in kilometers.

## Student test records

`data/demo_students.json` contains 20 fictional accounts (`Demo Student 001` through `Demo Student 020`) with reserved `example.test` email addresses and `DEMO-PASS-2026-###` pass numbers. Their pass rows are marked `verified` only for the local demo, with `verification_source=demo_seed`. No phone numbers, dates of birth, or real student information are included.

The seed script hashes the shared test password from `DEMO_STUDENT_PASSWORD` using bcryptjs. The example value in `.env.example` is for local demos only. Change it before a presentation and never use it for a real account.

After seeding, the demo login range is `student001@example.test` through `student020@example.test`; all use the configured `DEMO_STUDENT_PASSWORD`.

## Conductor demo assignment

`data/demo_conductors.json` contains one fictional conductor, a synthetic test bus, and a running sample trip on route `1000` Outbound. Its dashboard starts at the first stop and shows the route's ordered stops. The demo login is `conductor@example.test`; it uses `DEMO_CONDUCTOR_PASSWORD` when configured, otherwise the same password as `DEMO_STUDENT_PASSWORD`. There is no public conductor registration. Change demo passwords before a presentation and do not reuse them outside local development.

## Fare chart

`data/ordinary_fare_chart.json` transcribes the 30 chargeable stages and adult, child, and senior fares from [`source/ordinary_fare_chart_source.png`](source/ordinary_fare_chart_source.png), the image supplied by the project owner. The source's effective-date text is preserved verbatim as `04/05-11-2026`; it is not parsed because its date format is unclear. The schedule is labeled as user-provided and has not been independently verified. The chart contains no student-pass fare.

The project owner specified that a valid student pass means no fare is due per ride. The fare calculator applies that rule only to the count of passes verified by the backend; students without a verified pass are charged the adult rate. Any one-time pass application process or fee is separate from a ride fare and has not been priced here.

The workbook has stop order but no measured segment distances. For the prototype, the owner specified that three traveled stop intervals count as one 2 km chargeable stage. Any positive trip has at least one stage; trips are capped at the chart's 30-stage/60-km range. `route_stops.distance_from_previous_km` remains `NULL`; the calculator labels the resulting distance as an estimate. Replace this demo mapping if verified segment distances become available.
