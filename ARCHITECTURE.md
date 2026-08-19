# Architecture

## Why Vehicle and Device are separate

A `Vehicle` is the thing being tracked. A `Device` is whatever is currently reporting its GPS position — today an Android phone, later a dedicated GPS tracker, an OBD-II dongle, or an ESP32. Splitting them means replacing the phone with a real tracker later is "register a new `Device` row for the same `Vehicle`," not a schema change or a rewrite of the tracking pipeline. `Location` rows reference both, so history survives a device swap intact.

## Two separate authentication schemes

Users authenticate with a JWT (`Authorization: Bearer <token>`), issued at register/login and validated by Passport's JWT strategy (`src/auth`).

Devices authenticate with a **separate, long-lived opaque token** (`Authorization: Device <token>`), issued once when a device is registered (`POST /vehicles/:id/devices`) and never shown again. `DeviceAuthGuard` (`src/devices/guards/device-auth.guard.ts`) validates it independently of the user JWT system entirely — a device's credential should keep working even if the owning user's session expires or their password changes, and a user's session should never be usable to post GPS data (a phone app should carry the narrowest credential it needs).

The device token is hashed with **SHA-256, not bcrypt**, before storage (`src/common/utils/token.util.ts`). bcrypt's deliberate slowness defends against guessing a low-entropy secret (a password); a device token is a random 256-bit value with nothing to guess, and GPS ingestion can happen every few seconds, so a fast, constant-time-comparable hash is the right tradeoff. The hash is looked up directly (`WHERE deviceTokenHash = ?`, unique-indexed) rather than compared byte-by-byte against every device, so there's no timing side-channel to defend against in the first place.

Looking up a vehicle/device/geofence/trip/alert that exists but belongs to someone else returns `404`, not `403`, everywhere — so a response can't be used to probe what IDs exist.

## The GPS ingestion pipeline is event-driven

`TrackingService.ingestLocation` does exactly three things: validate the payload matches the authenticated device, reject an implausible GPS jump, and save the point. It then emits a `location.ingested` event (`@nestjs/event-emitter`) rather than calling trip detection, geofencing, alerts, or the WebSocket gateway directly.

```
POST /tracking/location
        |
        v
TrackingService.ingestLocation
        |  (validate, save)
        v
emit "location.ingested" ---+---> TrackingGateway        (location:update over WebSocket)
                             +---> TripDetectionService   (start/continue/end trip state machine)
                             +---> GeofenceDetectionService (enter/exit detection)
                             +---> AlertsEngineService    (overspeed check)
```

None of those four listeners import each other or the tracking module — they only share the event name and payload shape (`src/common/constants/events.ts`, `src/common/events/`). Geofence transitions and alert creation are themselves re-emitted as events (`geofence.entered/exited`, `alert.created`) for the same reason: `AlertsEngineService` reacts to a geofence transition without `GeofenceDetectionService` knowing alerts exist. This is what lets `TripsModule`, `GeofencesModule`, and `AlertsModule` be added in this order without ever circularly importing each other, and it's a natural seam for moving ingestion behind a real queue later — only the emit site and the listener registration would need to change, not the business logic in either.

Two things are inherently about the *absence* of events and so can't be triggered by an incoming point: a device going quiet, and a vehicle sitting stopped for a long time. Those run on a periodic `@Interval` sweep instead (`AlertsEngineService.sweepDeviceOffline`/`sweepLongStop`, `TripDetectionService.endStaleTrips`), each deduped against the latest alert/trip state so they fire once per episode, not once per sweep tick.

## Trip detection

A trip starts once **2 consecutive points** are at or above `TRIP_START_SPEED_KMH` — a single noisy GPS speed reading can't start one. While a trip is active, every point updates its distance (accumulated via Haversine from the trip's last point), duration, max speed, and average speed, *regardless* of that point's instantaneous speed. A `lastMovingAt` timestamp (internal-only column, not exposed via the API) only advances on points that are actually at/above the speed threshold — this is what lets a trip survive a red light or a traffic jam without ending, while still being endable. The 30-second sweep completes any trip whose `lastMovingAt` has aged past `TRIP_END_STOP_MINUTES`, using that timestamp (not "now") as `endedAt` — the trip's end time is when it actually stopped moving, not when the sweep happened to notice.

## Geofence state has no dedicated column

Whether a vehicle is currently inside a geofence is derived by looking at the most recent `GeofenceEvent` for that vehicle/geofence pair: if it was `ENTER`, the vehicle is considered inside; `EXIT` or no event at all, outside. A transition only produces a new event (and only then triggers an alert) when the computed inside/outside state disagrees with that last event — so a stationary vehicle sitting inside a geofence never produces a stream of duplicate `ENTER` events.

## Response envelope and error format

Every successful response is `{ success: true, data }`; every error is `{ success: false, error: { code, message } }` (`ResponseInterceptor` / `AllExceptionsFilter`). The health check is the one exception — monitoring tools expect its documented `{ status, database, timestamp }` shape at the top level, not nested, so it's excluded from the envelope.

## Pagination

Location history, trips, and alerts all use cursor pagination (`?cursor=<lastId>&limit=`), ordered by their natural timestamp with `id` as a tiebreaker, rather than offset/limit — a table that's actively being appended to (GPS points arriving every few seconds) would otherwise skip or repeat rows across pages as new data lands between requests.

## Prisma 7 and the driver adapter

Prisma 7 replaced the old Rust query-engine binary with client-side query compilation, which requires an explicit driver adapter for SQL databases (`@prisma/adapter-pg` here) rather than a bundled engine — smaller install, no native binary to ship, and the adapter owns the actual `pg` connection pool. The generated client lives at `backend/src/generated/prisma` (inside `src/`, not project root) specifically so it's covered by `tsconfig.build.json`'s `rootDir` inference — putting it as a sibling of `src/` broke `dist/main.js` landing at the top level of `dist/`.

The generated client's own files use `.js`-suffixed relative imports (correct for `tsc`, which really does emit `.js` files at those paths) — but `ts-jest` and `ts-node` transpile file-by-far-file without doing that rename, so requiring the client fails under them by default. Jest is fixed with a `moduleNameMapper` that strips the `.js` suffix so its resolver falls through to the sibling `.ts` file; standalone scripts (the seed script, this project's own tooling) use `tsx` instead of `ts-node`, which resolves this correctly out of the box.

## Redis: deferred, not designed around

Nothing in the current feature set needs a second stateful service: rate limiting and the trip/alert sweeps are in-process, and this is a single-instance deployment. Redis is a reasonable future addition (distributed rate limiting or caching across multiple backend instances) but isn't load-bearing for anything today, so it isn't running — see the commented-out block in `docker-compose.yml`.

## Handling more concurrent requests, without adding infra

A few config-level levers raise how much load the single instance can take, without the multi-instance restructuring Redis would require:

- **DB connection pool**: `PrismaService` now passes `DATABASE_POOL_MAX` (default 20) into `PrismaPg`'s underlying `pg.Pool`, instead of relying on `pg`'s implicit default of 10. Raise this alongside your Postgres server's `max_connections` if you see pool timeouts under load.
- **Split rate-limit buckets**: `POST /tracking/location` (GPS ingestion) previously shared the same 120/min global bucket as interactive dashboard API calls. It's device-authenticated and expected to arrive far more often, so it now gets its own bucket via `@Throttle` (`THROTTLE_INGESTION_LIMIT`, default 600/min) — see `tracking.controller.ts`, same pattern `auth.controller.ts` already used to tighten login/register. The app-wide default (`THROTTLE_LIMIT`) was also raised from 120 to 300/min.
- **Response compression**: `compression()` middleware was added in `bootstrap.ts`. Every response here already sets `Cache-Control: no-store` (see above), so nothing is ever served from a client cache — compressing the payload directly cuts bandwidth and latency per request.
- **Indexing**: `Trip` gained a `[vehicleId, startedAt]` index to support the day-wise trip filters (`TripQueryDto.from`/`to`) and the existing reports date-range queries, which previously only had `[vehicleId]`/`[vehicleId, status]` to lean on.

Deliberately out of scope here: enabling Redis, running multiple backend replicas, or restructuring the in-process trip-detection/alert-sweep singletons — those all remain real options if a single instance with these tunings stops being enough (see the Redis section above).

## Frontend: one file owns the map provider

`frontend/src/components/VehicleMap.tsx` is the only file that imports Leaflet. Every page/component that needs a map imports `VehicleMap` and passes it `{ latitude, longitude, label }` — nothing else knows or cares that it's Leaflet/OpenStreetMap underneath. Swapping to Google Maps later means rewriting this one file's internals to the same prop contract, not touching `DashboardPage.tsx` or anything else.

## Known limitations & future work

- **Trip distance during a stop can drift slightly** from GPS jitter, since distance accrues from every point while a trip is active regardless of instantaneous speed (see "Trip detection" above) — a deliberate simplification over adding a second minimum-movement threshold.
- **No refresh tokens** — a JWT is valid for `JWT_EXPIRES_IN` (default 7d) and then the user has to log in again. Fine for this scope; a real multi-device product would want short-lived access tokens plus a refresh flow.
- **No push/email/SMS notifications** — alerts are REST + WebSocket only.
- Extension points the schema/architecture were kept ready for, per the original spec, but not built: OBD-II fields (fuel, RPM, engine temp, DTCs), maintenance/insurance/PUC reminders, driver profiles, multi-vehicle fleet views, offline GPS buffering on the device side.
