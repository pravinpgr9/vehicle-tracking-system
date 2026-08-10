/**
 * Internal pub/sub event names (via @nestjs/event-emitter). These decouple
 * GPS ingestion from everything that reacts to it — the WebSocket gateway,
 * trip detection, geofencing, alerts — so none of those modules import each
 * other directly, and the ingestion pipeline could move behind a real queue
 * later without changing who emits or listens.
 *
 * Not the same as the WebSocket protocol's event names (see
 * tracking.gateway.ts): a listener here decides how/whether to translate
 * an internal event into something a client receives.
 */
export const AppEvent = {
  LOCATION_INGESTED: 'location.ingested',
  TRIP_STARTED: 'trip.started',
  TRIP_UPDATED: 'trip.updated',
  TRIP_COMPLETED: 'trip.completed',
  GEOFENCE_ENTERED: 'geofence.entered',
  GEOFENCE_EXITED: 'geofence.exited',
  ALERT_CREATED: 'alert.created',
} as const;
