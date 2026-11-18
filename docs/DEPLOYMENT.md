# Publish the BMTC demo

The app can be shared in two ways. A temporary tunnel is useful for a class presentation; a hosted deployment provides a more stable public URL. Both options use the same single-origin app build: Express serves the Vite production build and the `/api` endpoints.

## Temporary public link for a demo

This method keeps the app and MySQL on your laptop. Your laptop, MySQL service, backend, and tunnel must stay running while people use the link. Cloudflare Quick Tunnels create a temporary `trycloudflare.com` URL; the hostname changes when the tunnel is restarted and the tunnel stops when its process stops. Cloudflare describes Quick Tunnels as a development/testing feature, not a production host: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

1. Start MySQL and make sure `backend/.env` has working database settings.
2. In PowerShell, build the frontend and start the backend in production mode:

   ```powershell
   cd "D:\Mini Project\BMTC-Digital-Ticketing\frontend"
   npm.cmd run build
   cd "D:\Mini Project\BMTC-Digital-Ticketing\backend"
   npm.cmd run db:setup
   $env:NODE_ENV = "production"
   npm.cmd run start
   ```

   Keep this window open. The backend serves both the built website and the API on port 5000.

3. Install Cloudflare `cloudflared`, open another PowerShell window, then run:

   ```powershell
   cloudflared tunnel --url http://localhost:5000
   ```

4. Share the generated `https://….trycloudflare.com` URL. Do not share the local `.env` file or database password.

## Stable hosted link using Railway

This project includes a root `Dockerfile` that builds the React frontend and serves it from Express. Railway can build a service from a repository's Dockerfile, provide a MySQL service, and generate a public HTTPS domain. A Railway MySQL service is private by default; connect the app using Railway's private service variable references. See [Dockerfile deployments](https://docs.railway.com/builds/dockerfiles), [Railway MySQL](https://docs.railway.com/databases/mysql), [reference variables](https://docs.railway.com/variables), and [public domains](https://docs.railway.com/networking/domains/working-with-domains).

1. Push this project to a GitHub repository. Confirm `.env` is not committed; `.gitignore` excludes it. Railway can also deploy a local directory with its CLI if you prefer not to connect GitHub.
2. In Railway, create a project and add a MySQL service.
3. Add this repository as a service source. Railway detects the root `Dockerfile` and builds the frontend plus backend into one web service.
4. In the web service's Variables, set:

   ```text
   NODE_ENV=production
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   JWT_SECRET=<new random secret of at least 32 characters>
   DEMO_STUDENT_PASSWORD=<new demo password>
   DEMO_CONDUCTOR_PASSWORD=<new demo password>
   ```

   Replace `MySQL` with the exact name of your Railway database service. Use Railway's reference-variable picker where possible. The container runs `db:setup` before starting the app; this creates/updates the schema and inserts the fictional sample data. It reapplies the demo account passwords from the variables above whenever the container starts.

5. Deploy the services. In the web service, open **Settings → Networking → Generate Domain**. Share the generated HTTPS domain once `/api/health` reports `ok`.

Railway's current pricing includes a limited free trial/usage allowance and paid usage plans; it is not safe to assume a permanent, unlimited free service. The Hobby plan is listed at a $5 monthly minimum usage commitment, with extra usage billed beyond the included amount. Check the current [Railway pricing](https://railway.com/pricing) before deploying.

## Before sharing publicly

- Keep the demo dataset fictional. Do not load real student pass, identity, or contact information into this college prototype.
- Use a new production `JWT_SECRET` and demo passwords; never upload `backend/.env`.
- This project has no BMTC API integration or payment collection. Fares and route assignments are project sample data, not verified travel entitlements.
- The Railway setup command seeds the demo accounts on container start. Do not use this starter deployment as a production ticketing service without revisiting that behavior, database backups, account administration, monitoring, and BMTC fare/pass rules.
