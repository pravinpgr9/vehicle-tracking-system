# Test script: Nashik ↔ Malegaon round trip

A full, reviewable API walkthrough that exercises every core feature in one
scenario: registration → vehicle → device → geofences → a ~98 km outbound
trip (Nashik → Malegaon) → a ~98 km return trip (Malegaon → Nashik) →
verification of trips, distances, alerts, and geofence events.

Coordinates are real (Nashik ≈ `20.0056, 73.7891`, Malegaon ≈
`20.5579, 74.5288`); the straight-line distance between them is ~98.5 km
(the real road via NH160 is ~110 km — this test interpolates a straight
line between the two points rather than following the actual highway,
which is a fine approximation for exercising the API but means the
distances reported below are the straight-line figure, not the road one).

## Why the script waits 35 seconds between legs

A trip only completes when the periodic sweep notices the vehicle has been
still for `TRIP_END_STOP_MINUTES` (default 5) — and that check is against
the **real current time**, not the `recordedAt` values we send. All the
timestamps below are historical (hours in the past) so that as soon as the
sweep runs (every 30 real seconds), it will consider the trip stale and
close it. Sending both legs back-to-back with no pause would keep the
first trip "active" the whole time (new points keep arriving), merging
outbound and return into a single trip — the `sleep 35` between legs is
what lets the sweep actually close the outbound trip first.

## Prerequisites

- Backend running and reachable — this doc assumes `http://localhost:3000/api/v1`; change `API_BASE` at the top of the script if yours is elsewhere (e.g. `:3001`).
- `curl` and `node` on your PATH (used for parsing JSON responses — no `jq` dependency).

---

## Step 1 — Register, vehicle, device, geofences

These are the one-off setup calls; run them individually so you can see each response.

```bash
API_BASE="http://localhost:3000/api/v1"
EMAIL="roundtrip-$(date +%s)@example.com"

# 1. Register
REGISTER=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Round Trip Tester\",\"email\":\"$EMAIL\",\"password\":\"Str0ngPass!\"}")
echo "$REGISTER"
TOKEN=$(echo "$REGISTER" | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.accessToken')

# 2. Create vehicle
VEHICLE=$(curl -s -X POST "$API_BASE/vehicles" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Nashik-Malegaon Tester","registrationNumber":"MH15RT0001"}')
echo "$VEHICLE"
VEHICLE_ID=$(echo "$VEHICLE" | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')

# 3. Register device — copy this token, it's shown once
DEVICE=$(curl -s -X POST "$API_BASE/vehicles/$VEHICLE_ID/devices" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"deviceType":"PHONE","deviceIdentifier":"roundtrip-device"}')
echo "$DEVICE"
DEVICE_TOKEN=$(echo "$DEVICE" | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')

# 4. Geofences at both ends
curl -s -X POST "$API_BASE/geofences" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Nashik Home","latitude":20.0056,"longitude":73.7891,"radiusMeters":200}'
curl -s -X POST "$API_BASE/geofences" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Malegaon","latitude":20.5579,"longitude":74.5288,"radiusMeters":200}'

echo "VEHICLE_ID=$VEHICLE_ID"
echo "DEVICE_TOKEN=$DEVICE_TOKEN"
```

Keep this terminal/session open — `TOKEN`, `VEHICLE_ID`, and `DEVICE_TOKEN` are reused by everything below.

---

## Step 2 — Outbound leg: Nashik → Malegaon (14 points)

| # | lat | lon | speed (km/h) | +min | What it tests |
|---|-----|-----|---|---|---|
| 1 | 20.0056 | 73.7891 | 0 | 0 | Parked at Nashik Home |
| 2 | 20.0073 | 73.7913 | 18 | 2 | Leaving — exits the Nashik geofence |
| 3 | 20.0111 | 73.7965 | 35 | 4 | 2nd consecutive moving point → **trip starts** |
| 4 | 20.0222 | 73.8113 | 55 | 8 | Onto NH160 |
| 5 | 20.0719 | 73.8779 | 78 | 18 | Highway cruising |
| 6 | 20.1437 | 73.9740 | 95 | 30 | **Overspeed alert** (edge-triggered, >80) |
| 7 | 20.1823 | 74.0258 | 72 | 38 | Back under the limit |
| 8 | 20.2541 | 74.1220 | 0 | 50 | Toll plaza — **temporary stop** #1 |
| 9 | 20.2541 | 74.1220 | 0 | 53 | Still at toll (trip must NOT end here) |
| 10 | 20.2597 | 74.1294 | 40 | 56 | Resuming |
| 11 | 20.3480 | 74.2477 | 80 | 72 | Highway cruising |
| 12 | 20.4364 | 74.3661 | 65 | 88 | Approaching Malegaon |
| 13 | 20.5137 | 74.4696 | 30 | 100 | Entering Malegaon city |
| 14 | 20.5579 | 74.5288 | 0 | 108 | Arrived — **enters Malegaon geofence** |

(Point 1 also fires a one-off "ENTER Home" the moment it's inserted — the
geofence engine has no prior state for this vehicle yet, so being inside
on the very first point is indistinguishable from just having arrived.
Expected, not a bug.)

## Step 3 — Return leg: Malegaon → Nashik (14 points)

The mirror image of the outbound leg — same relative timing/speed shape (so distance and duration come out consistent with the outbound trip), reflected geographically so 2-consecutive-moving-points happens shortly after departure, not partway through:

| # | lat | lon | speed (km/h) | +min | What it tests |
|---|-----|-----|---|---|---|
| 1 | 20.5579 | 74.5288 | 0 | 0 | Parked at Malegaon |
| 2 | 20.5562 | 74.5265 | 18 | 2 | Leaving — exits Malegaon geofence |
| 3 | 20.5524 | 74.5214 | 35 | 4 | 2nd consecutive moving point → trip starts |
| 4 | 20.5413 | 74.5066 | 55 | 8 | Onto NH160 southbound |
| 5 | 20.4916 | 74.4400 | 78 | 18 | Highway cruising |
| 6 | 20.4198 | 74.3439 | 97 | 30 | **Overspeed alert** |
| 7 | 20.3812 | 74.2921 | 72 | 38 | Back under the limit |
| 8 | 20.3094 | 74.1959 | 0 | 50 | Toll plaza — temporary stop |
| 9 | 20.3094 | 74.1959 | 0 | 53 | Still at toll (trip must NOT end here) |
| 10 | 20.3038 | 74.1885 | 40 | 56 | Resuming |
| 11 | 20.2155 | 74.0702 | 80 | 72 | Highway cruising |
| 12 | 20.1271 | 73.9518 | 65 | 88 | Approaching Nashik |
| 13 | 20.0498 | 73.8483 | 30 | 100 | Entering Nashik city |
| 14 | 20.0056 | 73.7891 | 0 | 108 | Arrived home — **re-enters Nashik geofence** |

**A note on how this table was built, since getting it wrong once already broke the test:** it's tempting to build the return leg by just reversing the outbound coordinate list. That's wrong — it reverses the *order* but not the *position*, so the "2 consecutive moving points" that start the trip end up satisfied ~22% of the way into the return journey instead of right after departure, and the trip silently loses that first chunk of distance (a trip only accumulates from its start point onward). The fix is to reflect each point (`t → 1−t` along the Nashik–Malegaon line), not just reverse the list — which is what the table above and the script do. I hit exactly this bug once while building this test; if your own distances ever come out suspiciously short on one leg, this is the first thing to check.

---

## Step 4 — Run it

Save as `round-trip-test.sh` (also written to `backend/scripts/round-trip-test.sh` in the repo), make sure `TOKEN`, `VEHICLE_ID`, `DEVICE_TOKEN` from Step 1 are exported, then run it.

```bash
#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api/v1}"
: "${TOKEN:?export TOKEN from Step 1}"
: "${VEHICLE_ID:?export VEHICLE_ID from Step 1}"
: "${DEVICE_TOKEN:?export DEVICE_TOKEN from Step 1}"
DEVICE_ID="roundtrip-device"

send() {
  local base_epoch=$1 offset_min=$2 lat=$3 lon=$4 speed=$5
  local ts_epoch=$((base_epoch + offset_min * 60))
  local recorded_at
  recorded_at=$(date -u -r "$ts_epoch" +%Y-%m-%dT%H:%M:%S.000Z)
  curl -s -o /tmp/rt_resp.json -w "%{http_code}" -X POST "$API_BASE/tracking/location" \
    -H "Content-Type: application/json" -H "Authorization: Device $DEVICE_TOKEN" \
    -d "{\"deviceId\":\"$DEVICE_ID\",\"vehicleId\":\"$VEHICLE_ID\",\"latitude\":$lat,\"longitude\":$lon,\"speed\":$speed,\"recordedAt\":\"$recorded_at\"}" \
    | { read -r code; echo "  [$code] +${offset_min}min speed=${speed} ($lat, $lon)"; }
}

NOW=$(date -u +%s)

echo "=== Outbound: Nashik -> Malegaon ==="
OUT_BASE=$((NOW - 4*3600))
send $OUT_BASE 0   20.0056 73.7891 0
send $OUT_BASE 2   20.0073 73.7913 18
send $OUT_BASE 4   20.0111 73.7965 35
send $OUT_BASE 8   20.0222 73.8113 55
send $OUT_BASE 18  20.0719 73.8779 78
send $OUT_BASE 30  20.1437 73.9740 95
send $OUT_BASE 38  20.1823 74.0258 72
send $OUT_BASE 50  20.2541 74.1220 0
send $OUT_BASE 53  20.2541 74.1220 0
send $OUT_BASE 56  20.2597 74.1294 40
send $OUT_BASE 72  20.3480 74.2477 80
send $OUT_BASE 88  20.4364 74.3661 65
send $OUT_BASE 100 20.5137 74.4696 30
send $OUT_BASE 108 20.5579 74.5288 0

echo "Waiting 35s for the sweep to close the outbound trip..."
sleep 35

echo "=== Return: Malegaon -> Nashik ==="
RET_BASE=$((NOW - 2*3600))
send $RET_BASE 0   20.5579 74.5288 0
send $RET_BASE 2   20.5562 74.5265 18
send $RET_BASE 4   20.5524 74.5214 35
send $RET_BASE 8   20.5413 74.5066 55
send $RET_BASE 18  20.4916 74.4400 78
send $RET_BASE 30  20.4198 74.3439 97
send $RET_BASE 38  20.3812 74.2921 72
send $RET_BASE 50  20.3094 74.1959 0
send $RET_BASE 53  20.3094 74.1959 0
send $RET_BASE 56  20.3038 74.1885 40
send $RET_BASE 72  20.2155 74.0702 80
send $RET_BASE 88  20.1271 73.9518 65
send $RET_BASE 100 20.0498 73.8483 30
send $RET_BASE 108 20.0056 73.7891 0

echo "Waiting 35s for the sweep to close the return trip..."
sleep 35

echo "=== Done. Run the verification calls in Step 5. ==="
```

```bash
chmod +x round-trip-test.sh
API_BASE="http://localhost:3000/api/v1" TOKEN="$TOKEN" VEHICLE_ID="$VEHICLE_ID" DEVICE_TOKEN="$DEVICE_TOKEN" ./round-trip-test.sh
```

Total real run time: ~70 seconds (mostly the two 35s sweep waits).

---

## Step 5 — Verify

```bash
# Both trips, both COMPLETED, distance ~97-98 km each way
curl -s "$API_BASE/vehicles/$VEHICLE_ID/trips" -H "Authorization: Bearer $TOKEN"

# 8 alerts total (chronologically): ENTER Nashik (initial), EXIT Nashik, OVERSPEED (outbound),
# ENTER Malegaon, LONG_STOP, EXIT Malegaon, OVERSPEED (return), ENTER Nashik (final)
curl -s "$API_BASE/alerts?limit=20" -H "Authorization: Bearer $TOKEN"

# Current location should be back at Nashik (20.0056, 73.7891)
curl -s "$API_BASE/vehicles/$VEHICLE_ID/location" -H "Authorization: Bearer $TOKEN"

# Dashboard: todayTrips=2, todayDistanceKm ~195
curl -s "$API_BASE/dashboard/summary?vehicleId=$VEHICLE_ID" -H "Authorization: Bearer $TOKEN"
```

This exact scenario was run against a live instance while writing this doc. Actual results:

```
Trips:  [{ status: 'COMPLETED', distanceKm: '97.63', durationMin: '96.0', maxSpeed: 97, avgSpeed: '56.3' },
         { status: 'COMPLETED', distanceKm: '97.62', durationMin: '96.0', maxSpeed: 95, avgSpeed: '56.3' }]
Alerts: GEOFENCE_ENTER -> GEOFENCE_EXIT -> OVERSPEED -> GEOFENCE_ENTER -> LONG_STOP ->
        GEOFENCE_EXIT -> OVERSPEED -> GEOFENCE_ENTER   (8 total)
Location: 20.0056, 73.7891  (back at Nashik, exact)
Dashboard: { todayTrips: 2, todayDistanceKm: '195.25' }
```

The `LONG_STOP` alert is expected, not a bug: it's produced by the same historical-timestamp choice that makes the rest of this test fast to run — the instant a trip completes with an `endedAt` that's already hours old (because we backdated it), the long-stop sweep immediately sees "stopped since hours ago" and fires. In real usage, with genuinely live GPS data, this wouldn't fire until the vehicle had actually been stationary for `LONG_STOP_MINUTES`.

Checklist:

- [ ] `GET /trips` returns exactly 2 trips, both `status: "COMPLETED"`, each ~97-98 km
- [ ] Each trip's `maxSpeed` is 95 (outbound) / 97 (return)
- [ ] `GET /alerts` contains exactly 2 `OVERSPEED` entries, 3 `GEOFENCE_ENTER`, 2 `GEOFENCE_EXIT`, and 1 `LONG_STOP` (8 total)
- [ ] `GET /vehicles/{id}/location` shows you back at Nashik's exact coordinates
- [ ] Dashboard's `todayTrips` is 2 and `todayDistanceKm` is roughly double one trip's distance
- [ ] Opening the frontend dashboard for this account shows both trips in "Recent trips" with sensible distance/duration

If your numbers don't match this, paste me the actual response and I'll dig in — but note the one-way distance being ~20km short is exactly the reflection bug described in Step 3's note, so check that first if you've modified the coordinates.
