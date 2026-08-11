import { api } from './client';
import type {
  DashboardSummary,
  Geofence,
  PaginatedResponse,
  Trip,
  Vehicle,
} from './types';

export const endpoints = {
  listVehicles: () => api.get<Vehicle[]>('/vehicles'),
  getDashboardSummary: (vehicleId: string) =>
    api.get<DashboardSummary>(`/dashboard/summary?vehicleId=${vehicleId}`),
  listTrips: (vehicleId: string, limit = 10) =>
    api.get<PaginatedResponse<Trip>>(
      `/vehicles/${vehicleId}/trips?limit=${limit}`,
    ),
  listGeofences: () => api.get<Geofence[]>('/geofences'),
};
