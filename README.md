# Vehicle Tracking & Telematics Platform

Track a vehicle's location, trips, geofences, and alerts using an Android phone (or any GPS-capable device) as the tracker, with a NestJS backend, Postgres, a Socket.IO live feed, and a React dashboard.

```
Android Phone (GPS) --HTTPS--> NestJS Backend --+-- PostgreSQL
                                                  +-- WebSocket Gateway --> Dashboard
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design decisions, [API.md](API.md) for the full endpoint reference with `curl` examples, and [backend/DEVELOPMENT.md](backend/DEVELOPMENT.md) for day-to-day dev commands.

---

## Quick start — run both apps locally

Three terminals: backend, frontend, and (optionally) something to feed it GPS data. Ports used: backend `3000`, frontend `5173` (Vite's default).

### Prerequisites

- Node.js 24+
- A running PostgreSQL 14+ — a local install, [Postgres.app](https://postgresapp.com/), or `docker compose up -d postgres` from the repo root (needs Docker installed)

### Terminal 1 — Backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set at minimum:

```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<your_db_name>
JWT_SECRET=<any long random string>
```

(Everything else in `.env.example` already has a working default.)

```bash
npx prisma migrate dev    # creates all tables
npm run seed               # demo user + vehicle + device + geofences + trips + alerts
npm run start:dev
```

Leave this running. You should see Nest's startup log end with `Nest application successfully started`, and:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","database":"connected","timestamp":"..."}
```

`npm run seed` prints something like this — **copy the device token, you can't get it again**:

```
Seed complete:
  User:     demo@example.com / Str0ngPass!
  Vehicle:  My C3 (c4865721-...)
  Device:   android-car-001 (f22180f0-...)
  Device token (for the GPS simulator, shown only now):
    4790c9a24ad774dede64868b8c652d98f9f513dd4ef49a1e83b37bfc295d2879
```

### Terminal 2 — Frontend

```bash
cd frontend
npm install
cp .env.example .env    # defaults already point at http://localhost:3000
npm run dev
```

Open the URL it prints (typically `http://localhost:5173`) and log in with the seeded account: `demo@example.com` / `Str0ngPass!`. You should land on the dashboard and see the vehicle, today's stats, and the two seeded trips in "Recent trips" — that confirms the frontend is successfully talking to the backend.

### Terminal 3 (optional) — put a live dot on the map

The seed data is historical (today's trips already "happened"); to see the map marker actually move, feed it live GPS points with the simulator:

```bash
cd backend
export SIMULATOR_VEHICLE_ID=<vehicle id, e.g. from the seed output or GET /api/v1/vehicles>
export SIMULATOR_DEVICE_ID=android-car-001
export SIMULATOR_DEVICE_TOKEN=<the device token the seed script printed>
npm run gps:simulate
```

With the dashboard open in a browser, you should see the marker move and the speed/status update within a few seconds — no page refresh needed (it's coming over the WebSocket). `Ctrl+C` in this terminal to stop it.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Backend fails to start with a Prisma/connection error | `DATABASE_URL` is wrong, or Postgres isn't running / isn't reachable on that host:port |
| Frontend loads but login fails with a network error | Backend isn't running, or `VITE_API_URL` in `frontend/.env` doesn't match where it's actually listening |
| Login works but the map/dashboard shows nothing | No location data yet for that vehicle — run `npm run seed` and/or the GPS simulator |
| `EADDRINUSE` on port 3000 or 5173 | Something else is already listening there — `lsof -ti:3000 \| xargs kill` (or change `PORT` / pass `--port` to Vite) |
| GPS simulator prints "Missing required environment variables" | Set all three `SIMULATOR_*` vars — the device token only ever prints once, at registration/seed time |
| GPS simulator gets `401`/`403` responses | Device token doesn't match `SIMULATOR_DEVICE_ID`/`SIMULATOR_VEHICLE_ID`, or the device was deactivated |

---

## Project structure

```
backend/    NestJS API + WebSocket gateway + Prisma schema
frontend/   React/Vite dashboard
```

## Running tests

```bash
cd backend
npm test          # unit tests (no database needed)
npm run test:e2e  # integration tests against a real database
```

## Docker

```bash
docker compose up -d   # postgres + backend
```

Then run the frontend separately with `npm run dev` (or build it and serve `dist/` behind any static host / reverse proxy in front of the backend container).

## Production deployment notes

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, and a specific `CORS_ORIGIN` (not `*`) in the environment.
- Run `npx prisma migrate deploy` (not `migrate dev`) against the production database as part of your deploy step.
- `backend/Dockerfile` builds a production image (`npm run build` + `node dist/main.js`); it does not run migrations itself — run them as a separate step before starting new containers.
- Put the backend behind a reverse proxy (TLS termination, `X-Forwarded-*` headers) in front of the container.
- The frontend is a static build (`npm run build` in `frontend/`) — serve `dist/` from any static host/CDN, pointed at the backend's real URL via `VITE_API_URL`/`VITE_WS_URL`.

## Known limitations

See [ARCHITECTURE.md](ARCHITECTURE.md#known-limitations--future-work).
