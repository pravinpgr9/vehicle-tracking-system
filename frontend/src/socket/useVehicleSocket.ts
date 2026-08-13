import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from '../api/client';
import type { Alert, LocationUpdateEvent, Trip } from '../api/types';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';
const MAX_RECENT_ALERTS = 10;

interface VehicleSocketState {
  connected: boolean;
  liveLocation: LocationUpdateEvent | null;
  liveTrip: Trip | null;
  recentAlerts: Alert[];
}

/**
 * Joins the given vehicle's room and keeps live location/trip/alert state
 * in sync via the same events TrackingGateway broadcasts (see backend
 * ARCHITECTURE.md) — no polling.
 */
export function useVehicleSocket(vehicleId: string | null): VehicleSocketState {
  const [state, setState] = useState<VehicleSocketState>({
    connected: false,
    liveLocation: null,
    liveTrip: null,
    recentAlerts: [],
  });

  useEffect(() => {
    // Switching vehicles must drop the previous vehicle's live trip/location —
    // otherwise they stay pinned at the top of "Recent trips" for the newly
    // selected vehicle until a fresh event happens to arrive for it.
    setState({
      connected: false,
      liveLocation: null,
      liveTrip: null,
      recentAlerts: [],
    });

    if (!vehicleId) {
      return;
    }
    const token = getToken();
    if (!token) {
      return;
    }

    const socket: Socket = io(WS_URL, { auth: { token } });

    socket.on('connect', () => {
      setState((prev) => ({ ...prev, connected: true }));
      socket.emit('vehicle:join', { vehicleId });
    });
    socket.on('disconnect', () => {
      setState((prev) => ({ ...prev, connected: false }));
    });
    socket.on('location:update', (event: LocationUpdateEvent) => {
      setState((prev) => ({ ...prev, liveLocation: event }));
    });
    socket.on('trip:started', (trip: Trip) => {
      setState((prev) => ({ ...prev, liveTrip: trip }));
    });
    socket.on('trip:updated', (trip: Trip) => {
      setState((prev) => ({ ...prev, liveTrip: trip }));
    });
    socket.on('trip:completed', (trip: Trip) => {
      setState((prev) => ({ ...prev, liveTrip: trip }));
    });
    socket.on('alert:created', (alert: Alert) => {
      setState((prev) => ({
        ...prev,
        recentAlerts: [alert, ...prev.recentAlerts].slice(0, MAX_RECENT_ALERTS),
      }));
    });

    return () => {
      socket.emit('vehicle:leave', { vehicleId });
      socket.disconnect();
    };
  }, [vehicleId]);

  return state;
}
