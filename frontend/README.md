# Vehicle Tracking Dashboard (frontend)

React + TypeScript + Vite dashboard for the Vehicle Tracking & Telematics Platform backend (`../backend`).

## Setup

```bash
npm install
cp .env.example .env   # point VITE_API_URL / VITE_WS_URL at the backend if not localhost:3000
npm run dev
```

Log in with the seeded demo account (`demo@example.com` / `Str0ngPass!`, see `../backend/DEVELOPMENT.md`) or register a new one.

## What's here

- `src/auth/` — JWT auth context (register/login/logout, token persisted to `localStorage`)
- `src/api/` — typed REST client (`client.ts`) and endpoint wrappers (`endpoints.ts`)
- `src/socket/useVehicleSocket.ts` — joins a vehicle's WebSocket room and keeps live location/trip/alert state in sync
- `src/components/VehicleMap.tsx` — the only file that knows about Leaflet; swapping map providers later means changing this file, not its call sites
- `src/pages/` — Login and Dashboard

## Scripts

```bash
npm run dev     # dev server
npm run build   # type-check (tsc -b) + production build
npm run lint    # oxlint
npm run preview # preview the production build
```
