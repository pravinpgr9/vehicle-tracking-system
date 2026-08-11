export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export type VehicleStatus = 'ACTIVE' | 'INACTIVE';

export interface Vehicle {
  id: string;
  userId: string;
  name: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  vehicleId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  batteryLevel: number | null;
  recordedAt: string;
  receivedAt: string;
}

export type TripStatus = 'ACTIVE' | 'COMPLETED';

export interface Trip {
  id: string;
  vehicleId: string;
  startedAt: string;
  endedAt: string | null;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number | null;
  endLongitude: number | null;
  distanceMeters: number;
  durationSeconds: number | null;
  maxSpeed: number;
  averageSpeed: number;
  status: TripStatus;
}

export interface DeviceStatus {
  isActive: boolean;
  lastSeenAt: string | null;
  online: boolean;
}

export interface DashboardSummary {
  vehicleStatus: VehicleStatus;
  currentLocation: Location | null;
  currentSpeed: number | null;
  todayDistanceKm: number;
  todayTrips: number;
  lastTrip: Trip | null;
  deviceStatus: DeviceStatus | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export type AlertType =
  | 'OVERSPEED'
  | 'GEOFENCE_ENTER'
  | 'GEOFENCE_EXIT'
  | 'DEVICE_OFFLINE'
  | 'LONG_STOP';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Alert {
  id: string;
  vehicleId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  occurredAt: string;
  readAt: string | null;
}

export interface LocationUpdateEvent {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
}
