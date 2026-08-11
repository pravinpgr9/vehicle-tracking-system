#!/usr/bin/env bash
# Sends a simulated Nashik <-> Malegaon round trip to a running backend.
# See ../../ROUND_TRIP_TEST.md for the full walkthrough and what to expect.
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api/v1}"
: "${TOKEN:?export TOKEN (user JWT from POST /auth/login or /auth/register)}"
: "${VEHICLE_ID:?export VEHICLE_ID}"
: "${DEVICE_TOKEN:?export DEVICE_TOKEN}"
DEVICE_ID="${DEVICE_ID:-roundtrip-device}"

send() {
  local base_epoch=$1 offset_min=$2 lat=$3 lon=$4 speed=$5
  local ts_epoch=$((base_epoch + offset_min * 60))
  local recorded_at
  recorded_at=$(date -u -r "$ts_epoch" +%Y-%m-%dT%H:%M:%S.000Z)
  local code
  code=$(curl -s -o /tmp/rt_resp.json -w "%{http_code}" -X POST "$API_BASE/tracking/location" \
    -H "Content-Type: application/json" -H "Authorization: Device $DEVICE_TOKEN" \
    -d "{\"deviceId\":\"$DEVICE_ID\",\"vehicleId\":\"$VEHICLE_ID\",\"latitude\":$lat,\"longitude\":$lon,\"speed\":$speed,\"recordedAt\":\"$recorded_at\"}")
  echo "  [$code] +${offset_min}min speed=${speed} ($lat, $lon)"
  if [ "$code" != "201" ]; then
    cat /tmp/rt_resp.json
    echo
  fi
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

echo "=== Done. See ROUND_TRIP_TEST.md Step 5 for verification calls. ==="
