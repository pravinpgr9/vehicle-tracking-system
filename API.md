# API Reference

Base URL: `http://localhost:3000/api/v1` (health check is unversioned: `http://localhost:3000/api/health`).

**Interactive docs (Swagger UI):** http://localhost:3000/api/docs — every endpoint below is also there, with live "Try it out" buttons. This file exists for copy-pasteable `curl` examples.

## Conventions

- All successful responses are wrapped as `{"success": true, "data": ...}`.
- All errors are `{"success": false, "error": {"code": "...", "message": "..."}}` with an appropriate HTTP status.
- Endpoints under `/vehicles`, `/geofences`, `/alerts`, `/reports`, `/dashboard`, `/trips` require `Authorization: Bearer <accessToken>` (a **user** JWT from login/register).
- `POST /tracking/location` requires `Authorization: Device <deviceToken>` instead — a separate, per-device secret issued once when the device is registered. Never use a user JWT there, and never use a device token anywhere else.

## Quick start with the seeded demo account

`npm run seed` (see [DEVELOPMENT.md](backend/DEVELOPMENT.md)) creates:

- User: `demo@example.com` / `Str0ngPass!`
- Vehicle: "My C3"
- Device: `android-car-001` (the seed script prints its device token once — copy it if you want to run the GPS simulator against this vehicle)
- Geofences: "Home", "Office"
- 2 completed trips (today) + 3 sample alerts

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Str0ngPass!"}'
```

Save `data.accessToken` from the response — every example below assumes it's in `$TOKEN`:

```bash
TOKEN="paste-the-access-token-here"
```

---

## Auth

### Register

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Pravin Pagare","email":"pravin@example.com","password":"Str0ngPass!"}'
```

### Login

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pravin@example.com","password":"Str0ngPass!"}'
```

Both return `{ accessToken, user }`.

### Current user

```bash
curl -s http://localhost:3000/api/v1/users/me -H "Authorization: Bearer $TOKEN"
```

---

## Vehicles

```bash
# Create
curl -s -X POST http://localhost:3000/api/v1/vehicles \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"My C3","registrationNumber":"MH15AB1234","make":"Citroen","model":"C3","year":2022}'

# List
curl -s http://localhost:3000/api/v1/vehicles -H "Authorization: Bearer $TOKEN"

# Get one / update / delete
curl -s http://localhost:3000/api/v1/vehicles/$VEHICLE_ID -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH http://localhost:3000/api/v1/vehicles/$VEHICLE_ID \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"status":"INACTIVE"}'
curl -s -X DELETE http://localhost:3000/api/v1/vehicles/$VEHICLE_ID -H "Authorization: Bearer $TOKEN"
```

A vehicle that exists but belongs to another user returns `404 VEHICLE_NOT_FOUND`, not `403` — ownership can't be probed from the response.

---

## Devices

Register a device for a vehicle to get its **device token** — shown exactly once, in this response. Store it wherever the tracker (phone app, GPS simulator, etc.) will run.

```bash
curl -s -X POST http://localhost:3000/api/v1/vehicles/$VEHICLE_ID/devices \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"deviceType":"PHONE","deviceIdentifier":"android-car-001","platform":"android"}'
```

```bash
curl -s http://localhost:3000/api/v1/vehicles/$VEHICLE_ID/devices -H "Authorization: Bearer $TOKEN"

# Deactivate a device (soft — history is kept)
curl -s -X PATCH http://localhost:3000/api/v1/vehicles/$VEHICLE_ID/devices/$DEVICE_ID \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"isActive":false}'
```

---

## GPS ingestion (device-authenticated)

```bash
curl -s -X POST http://localhost:3000/api/v1/tracking/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Device $DEVICE_TOKEN" \
  -d '{
    "deviceId": "android-car-001",
    "vehicleId": "'"$VEHICLE_ID"'",
    "latitude": 20.0056,
    "longitude": 73.7891,
    "speed": 42.5,
    "heading": 180,
    "accuracy": 8,
    "batteryLevel": 82,
    "recordedAt": "2026-08-10T17:02:15.000Z"
  }'
```

`deviceId`/`vehicleId` in the body must match the device the token belongs to, or the request is rejected (`400 VALIDATION_ERROR`) even though the token itself is valid — this stops a misconfigured client from posting under the wrong vehicle. A point implying an implausible jump (see `GPS_MAX_JUMP_METERS`/`GPS_MAX_JUMP_SECONDS` in `.env`) is rejected the same way.

Or just run the simulator instead of crafting requests by hand — see [DEVELOPMENT.md](backend/DEVELOPMENT.md#gps-simulator).

---

## Locations (user-authenticated)

```bash
# Most recent point
curl -s http://localhost:3000/api/v1/vehicles/$VEHICLE_ID/location -H "Authorization: Bearer $TOKEN"

# History, cursor-paginated
curl -s "http://localhost:3000/api/v1/vehicles/$VEHICLE_ID/locations?limit=50" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/v1/vehicles/$VEHICLE_ID/locations?from=2026-08-10T00:00:00Z&to=2026-08-10T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Trips

```bash
curl -s "http://localhost:3000/api/v1/vehicles/$VEHICLE_ID/trips?limit=20" -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/api/v1/vehicles/$VEHICLE_ID/trips/$TRIP_ID -H "Authorization: Bearer $TOKEN"
```

---

## Geofences

```bash
curl -s -X POST http://localhost:3000/api/v1/geofences \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Home","latitude":20.0056,"longitude":73.7891,"radiusMeters":200}'

curl -s http://localhost:3000/api/v1/geofences -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH http://localhost:3000/api/v1/geofences/$GEOFENCE_ID \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"isActive":false}'
curl -s -X DELETE http://localhost:3000/api/v1/geofences/$GEOFENCE_ID -H "Authorization: Bearer $TOKEN"
```

Enter/exit events (and the corresponding alerts) are generated automatically as GPS points come in — see `ARCHITECTURE.md`.

---

## Alerts

```bash
curl -s "http://localhost:3000/api/v1/alerts?limit=20" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/v1/alerts?unreadOnly=true" -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH http://localhost:3000/api/v1/alerts/$ALERT_ID/read -H "Authorization: Bearer $TOKEN"
```

Types: `OVERSPEED`, `GEOFENCE_ENTER`, `GEOFENCE_EXIT`, `DEVICE_OFFLINE`, `LONG_STOP`.

---

## Reports

```bash
curl -s "http://localhost:3000/api/v1/reports/daily?vehicleId=$VEHICLE_ID&date=2026-08-10" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/v1/reports/monthly?vehicleId=$VEHICLE_ID&month=2026-08" -H "Authorization: Bearer $TOKEN"
```

`date`/`month` default to today/this month (UTC) if omitted.

---

## Dashboard

```bash
curl -s "http://localhost:3000/api/v1/dashboard/summary?vehicleId=$VEHICLE_ID" -H "Authorization: Bearer $TOKEN"
```

Composes vehicle status, current location, today's distance/trip count, the last trip, and device online status into one call — what the frontend dashboard renders on load.

---

## Health check

```bash
curl -s http://localhost:3000/api/health
```

Returns the plain `{ status, database, timestamp }` shape (not the `{success,data}` envelope — see `ARCHITECTURE.md`).

---

## WebSocket (Socket.IO)

Connect to `http://localhost:3000` with the same user JWT:

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000', { auth: { token: accessToken } });
socket.emit('vehicle:join', { vehicleId });
socket.on('location:update', console.log);
socket.on('trip:started', console.log);
socket.on('trip:updated', console.log);
socket.on('trip:completed', console.log);
socket.on('geofence:entered', console.log);
socket.on('geofence:exited', console.log);
socket.on('alert:created', console.log);
```

`vehicle:join`/`vehicle:leave` are ownership-checked server-side; a connection with a missing/invalid token is dropped immediately.

---

## Full example flow, end to end

```bash
# 1. Register + login
curl -s -X POST http://localhost:3000/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Demo","email":"demo2@example.com","password":"Str0ngPass!"}' | tee /tmp/register.json
TOKEN=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/register.json")).data.accessToken')

# 2. Create a vehicle
curl -s -X POST http://localhost:3000/api/v1/vehicles -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"My C3","registrationNumber":"MH15AB1234"}' | tee /tmp/vehicle.json
VEHICLE_ID=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/vehicle.json")).data.id')

# 3. Register a device
curl -s -X POST http://localhost:3000/api/v1/vehicles/$VEHICLE_ID/devices -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"deviceType":"PHONE","deviceIdentifier":"android-car-001"}' | tee /tmp/device.json
DEVICE_TOKEN=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/device.json")).data.token')

# 4. Send a GPS point
curl -s -X POST http://localhost:3000/api/v1/tracking/location -H "Content-Type: application/json" \
  -H "Authorization: Device $DEVICE_TOKEN" \
  -d '{"deviceId":"android-car-001","vehicleId":"'"$VEHICLE_ID"'","latitude":20.0056,"longitude":73.7891,"speed":20,"recordedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'"}'

# 5. Check the dashboard
curl -s "http://localhost:3000/api/v1/dashboard/summary?vehicleId=$VEHICLE_ID" -H "Authorization: Bearer $TOKEN"
```
