# How the system behaves in real time

[ROUND_TRIP_TEST.md](ROUND_TRIP_TEST.md) backdates GPS timestamps so a
long trip can be tested in under 2 minutes. This document is the
opposite: real current timestamps, real `sleep` between calls — exactly
what happens when an actual phone is sending live GPS data.

## The two kinds of reaction

| | Triggered by | When it happens |
|---|---|---|
| **Immediate** | The GPS point itself | Synchronously, as part of that `POST /tracking/location` request — by the time you get the `201` back, trip start/continue, geofence enter/exit, and overspeed have already happened |
| **Delayed** | Absence of new points | A background sweep that runs every 30 real seconds, checking "has enough real time passed since the last relevant point?" |

Trip start, trip *continuing*, geofence enter/exit, and overspeed are all
**immediate** — no polling or waiting needed, they're done before your
`curl` command's response even prints. Trip *completion*, device-offline,
and long-stop are **delayed** — they depend on real wall-clock time
elapsing with nothing new arriving, since by definition they're each
about something *not happening*.

---

## Live walkthrough (actually run, just now)

Setup was the usual (register → vehicle → device → geofence at
`20.0056, 73.7891` r=200m). Every `recordedAt` below is the genuine
current time at the moment each `curl` ran, with a real 6-second `sleep`
between calls — nothing backdated.

```bash
ping() {
  local lat=$1 lon=$2 speed=$3
  local now=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  curl -s -X POST "$API_BASE/tracking/location" \
    -H "Content-Type: application/json" -H "Authorization: Device $DEVICE_TOKEN" \
    -d "{\"deviceId\":\"$DEVICE_ID\",\"vehicleId\":\"$VEHICLE_ID\",\"latitude\":$lat,\"longitude\":$lon,\"speed\":$speed,\"recordedAt\":\"$now\"}"
}

ping 20.0056 73.7891 0    # parked at Home
sleep 6
ping 20.0060 73.7895 20   # starting to move
sleep 6
ping 20.0065 73.7900 30   # 2nd consecutive moving point
sleep 6
ping 20.0065 73.7900 95   # same spot, reports 95 km/h
sleep 6
ping 20.0090 73.7930 60   # ~350m away now
```

What actually happened, in real time, no waiting beyond the 6s between calls:

| Real time | Call | Immediately after, `GET` showed |
|---|---|---|
| T+0s | Ping 1, speed 0 | (nothing yet — first point ever, but see note below) |
| T+6s | Ping 2, speed 20 | Still no trip — only 1 of the last 2 points is a "mover" |
| T+12s | Ping 3, speed 30 | **`GET /trips` → `status: "ACTIVE"`**, immediately |
| T+18s | Ping 4, speed 95 (same spot) | **`GET /alerts` → `OVERSPEED`** appears, immediately |
| T+24s | Ping 5, ~350m away | **`GET /alerts` → `GEOFENCE_EXIT`** appears, immediately |

(You'll also see a `GEOFENCE_ENTER` timestamped at Ping 1 in the alerts
list — the geofence engine has no prior state for a brand-new vehicle, so
being inside a geofence on the very first point it ever reports is
indistinguishable from just having arrived. Expected, not a bug — same
thing noted in ROUND_TRIP_TEST.md.)

Total elapsed real time for all of this: **24 seconds**. That's the point
— none of this needs waiting for a background job; it's all resolved by
the time each request returns.

---

## The delayed reactions — go watch this one yourself

The test vehicle from the walkthrough above is still live in the
database right now (I didn't clean it up, on purpose). Its trip is
currently `ACTIVE`. Using the defaults in `.env.example`:

```bash
API_BASE="http://localhost:3000/api/v1"
VEHICLE_ID="a7123963-7217-463d-8ac2-2b8f7df3d330"

# Log back in to get a fresh token (this account was created for this demo):
curl -s -X POST "$API_BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"realtime-demo-1786425791@example.com","password":"Str0ngPass!"}'
```

- **Right now**: `GET /vehicles/$VEHICLE_ID/trips` → `status: "ACTIVE"`
- **Wait ~5 minutes** (no more GPS points sent) → the sweep (every 30s) will notice `lastMovingAt` is older than `TRIP_END_STOP_MINUTES` (default 5) → check again → **`status: "COMPLETED"`**, with `endedAt` set to the moment of the *last moving point* (Ping 5's timestamp), not whenever you happen to check
- **Wait ~10 minutes total** from Ping 5 (no more GPS points at all) → `GET /alerts` → a **`DEVICE_OFFLINE`** alert appears, once `DEVICE_OFFLINE_MINUTES` (default 10) has passed since the device's `lastSeenAt`
- **Wait ~15 minutes total** from the trip's `endedAt` → `GET /alerts` → a **`LONG_STOP`** alert appears, once `LONG_STOP_MINUTES` (default 15) has passed with the vehicle stationary after a completed trip

None of these need you to call anything to "trigger" them — just `GET /trips` or `GET /alerts` again after the wait and they'll already be there, produced by the backend's own background sweep. If you want to see it happen without babysitting a terminal, open the frontend dashboard for this account — the trip's status and the alert list will update on their own.

---

## The easiest way to see all of this continuously

This whole walkthrough — pings arriving in genuine real time, trip
start/continue/complete, geofence transitions, overspeed — is exactly
what `npm run gps:simulate` already does, on a loop, indefinitely:

```bash
cd backend
export SIMULATOR_VEHICLE_ID=<id> SIMULATOR_DEVICE_ID=<identifier> SIMULATOR_DEVICE_TOKEN=<token>
npm run gps:simulate
```

Leave it running with the dashboard open in a browser tab and you'll see
the marker move, trips start and complete, and alerts appear, all without
touching curl or Swagger again.
