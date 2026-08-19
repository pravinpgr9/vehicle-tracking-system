import { api } from './client';
import type {
  DashboardSummary,
  Geofence,
  Location,
  PaginatedResponse,
  Trip,
  Vehicle,
} from './types';

export interface TripDateRange {
  from?: string;
  to?: string;
}

export const endpoints = {
  listVehicles: () => api.get<Vehicle[]>('/vehicles'),
  getDashboardSummary: (vehicleId: string) =>
    api.get<DashboardSummary>(`/dashboard/summary?vehicleId=${vehicleId}`),
  listTrips: (vehicleId: string, options: { limit?: number } & TripDateRange = {}) => {
    const { limit = 10, from, to } = options;
    const params = new URLSearchParams({ limit: String(limit) });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return api.get<PaginatedResponse<Trip>>(
      `/vehicles/${vehicleId}/trips?${params.toString()}`,
    );
  },
  listGeofences: () => api.get<Geofence[]>('/geofences'),
  listRecentLocations: (vehicleId: string, limit = 150) =>
    api.get<PaginatedResponse<Location>>(
      `/vehicles/${vehicleId}/locations?limit=${limit}`,
    ),
};
