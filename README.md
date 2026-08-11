# Vehicle Tracking & Telematics Platform

Track a vehicle's location, trips, geofences, and alerts using an Android phone (or any GPS-capable device) as the tracker, with a NestJS backend, Postgres, a Socket.IO live feed, and a React dashboard.

```
Android Phone (GPS) --HTTPS--> NestJS Backend --+-- PostgreSQL
                                                  +-- WebSocket Gateway --> Dashboard
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design decisions behind this, [API.md](API.md) for the full endpoint reference with `curl` examples, and [backend/DEVELOPMENT.md](backend/DEVELOPMENT.md) for day-to-day dev commands.

## Requirements

- Node.js 24+
- PostgreSQL 14+ (local install, [Postgres.app](https://postgresapp.com/), or the provided `docker-compose.yml`)

## Project structure

```
backend/    NestJS API + WebSocket gateway + Prisma schema
frontend/   React/Vite dashboard
```

## Installation

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`: at minimum, set `DATABASE_URL` to a real Postgres connection string and `JWT_SECRET` to a long random value. The rest of the variables have sensible defaults — see the comments in `.env.example` for what each one controls (trip detection thresholds, alert thresholds, GPS jump validation, rate limiting).

## Database setup, migration, seed

```bash
npx prisma migrate dev   # creates the schema
npm run seed              # optional: demo user, vehicle, device, geofences, trips, alerts
```

`npm run seed` prints the demo account's credentials and its device's one-time token to the console — see [backend/DEVELOPMENT.md](backend/DEVELOPMENT.md#seed-data).

## Running the backend

```bash
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/api/docs`
- Health check: `http://localhost:3000/api/health`

## Running the frontend

```bash
cd frontend
npm install
cp .env.example .env   # defaults already point at localhost:3000
npm run dev
```

Open the printed local URL and log in with the seeded demo account (or register a new one).

## Running the GPS simulator

Sends realistic simulated GPS points to a running backend — see [backend/DEVELOPMENT.md](backend/DEVELOPMENT.md#gps-simulator):

```bash
cd backend
export SIMULATOR_VEHICLE_ID=<id> SIMULATOR_DEVICE_ID=<identifier> SIMULATOR_DEVICE_TOKEN=<token>
npm run gps:simulate
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
