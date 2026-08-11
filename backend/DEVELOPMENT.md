# Development Guide

## Prerequisites

- Node.js 24+
- A PostgreSQL database (local install, Postgres.app, or `docker compose up -d postgres` from the repo root)

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in DATABASE_URL, JWT_SECRET, etc.
npx prisma migrate dev # creates the schema
npm run seed            # optional: demo user, vehicle, device, geofences, trips, alerts
npm run start:dev
```

The server listens on `http://localhost:3000`. Swagger UI: `http://localhost:3000/api/docs`. Health check: `http://localhost:3000/api/health`.

Full endpoint reference with `curl` examples: [../API.md](../API.md).

## Seed data

`npm run seed` wipes and recreates a demo account:

- `demo@example.com` / `Str0ngPass!`
- Vehicle "My C3" with two completed trips today (Home ↔ Office) and a few sample alerts
- Geofences "Home" and "Office"
- A device (`android-car-001`) — **the seed script prints its device token to the console once**; copy it if you want to drive that same vehicle with the GPS simulator instead of registering a fresh device

Re-run it any time to reset back to a clean demo state.

## GPS simulator

Sends realistic simulated GPS points to a running backend, so trips/geofences/alerts/WebSocket can be exercised without a phone.

```bash
export SIMULATOR_VEHICLE_ID=<vehicle id>
export SIMULATOR_DEVICE_ID=<deviceIdentifier, e.g. android-car-001>
export SIMULATOR_DEVICE_TOKEN=<device token from registration or the seed script>
npm run gps:simulate
```

It drives Home → Office → Home on a loop, with a brief mid-route stop each way and a parked pause at each end — enough to exercise trip start/continue/temporary-stop/end and geofence enter/exit. `SIMULATOR_INTERVAL_MS` (default 5000) controls how often it sends a point; `Ctrl+C` to stop.

## Tests

```bash
npm test          # unit tests
npm run test:cov  # with coverage
npm run test:e2e  # integration tests against a real database (see test/)
```

## Database

```bash
npx prisma studio        # browse data in a GUI
npx prisma migrate dev   # create + apply a migration after changing schema.prisma
npm run prisma:studio    # same as above, via npm script
```

## Docker

```bash
docker compose up -d     # postgres + backend, from the repo root
```

## Code quality

```bash
npm run lint    # ESLint + Prettier, auto-fixes
npm run build   # tsc via `nest build` — also the fastest way to catch type errors
```
