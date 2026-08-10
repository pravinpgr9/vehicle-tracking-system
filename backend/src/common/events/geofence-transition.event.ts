import { Geofence, GeofenceEvent } from '../../generated/prisma/client';

export class GeofenceTransitionEvent {
  constructor(
    public readonly event: GeofenceEvent,
    public readonly geofence: Geofence,
  ) {}
}
