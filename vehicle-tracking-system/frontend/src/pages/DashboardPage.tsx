import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useVehicleSocket } from '../socket/useVehicleSocket';
import { StatusPanel } from '../components/StatusPanel';
import { TripList } from '../components/TripList';
import { VehicleMap } from '../components/VehicleMap';
import { DistanceChart } from '../components/DistanceChart';
import type { DashboardSummary, Geofence, Trip, Vehicle } from '../api/types';
import './DashboardPage.css';

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong';
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => {
    setError(null);
    setRetryToken((token) => token + 1);
  }, []);

  const { liveLocation, liveTrip, recentAlerts } = useVehicleSocket(selectedVehicleId);

  useEffect(() => {
    Promise.all([endpoints.listVehicles(), endpoints.listGeofences()])
      .then(([vehicleList, geofenceList]) => {
        setVehicles(vehicleList);
        setGeofences(geofenceList);
        setSelectedVehicleId((current) => current ?? vehicleList[0]?.id ?? null);
        if (vehicleList.length === 0) {
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        setError(errorMessage(err));
        setIsLoading(false);
      });
  }, [retryToken]);

  useEffect(() => {
    if (!selectedVehicleId) {
      return;
    }
    setIsLoading(true);
    Promise.all([
      endpoints.getDashboardSummary(selectedVehicleId),
      endpoints.listTrips(selectedVehicleId),
    ])
      .then(([summaryResult, tripsResult]) => {
        setSummary(summaryResult);
        setTrips(tripsResult.items);
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [selectedVehicleId, retryToken]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const location = liveLocation ?? summary?.currentLocation ?? null;
  const speedKmh = liveLocation?.speed ?? summary?.currentSpeed ?? null;
  const displayedTrips = liveTrip
    ? [liveTrip, ...trips.filter((t) => t.id !== liveTrip.id)]
    : trips;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>Vehicle Tracking Dashboard</h1>
        <div className="dashboard-header-actions">
          {vehicles.length > 1 && (
            <select
              value={selectedVehicleId ?? ''}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
            </select>
          )}
          <span className="dashboard-user">{user?.name}</span>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {error && (
        <p className="dashboard-error">
          {error}{' '}
          <button type="button" onClick={retry}>
            Retry
          </button>
        </p>
      )}

      {!error && isLoading && <p className="dashboard-loading">Loading…</p>}

      {!error && !isLoading && !selectedVehicle && (
        <p className="dashboard-empty">
          No vehicles yet. Create one via the API to get started.
        </p>
      )}

      {!error && !isLoading && selectedVehicle && summary && (
        <div className="dashboard-grid">
          <div className="card dashboard-status">
            <StatusPanel
              vehicle={selectedVehicle}
              status={summary.vehicleStatus}
              speedKmh={speedKmh}
              todayTrips={summary.todayTrips}
              todayDistanceKm={summary.todayDistanceKm}
              deviceOnline={summary.deviceStatus?.online ?? false}
              deviceLastSeenAt={summary.deviceStatus?.lastSeenAt ?? null}
            />
          </div>

          <div className="card dashboard-map">
            {location ? (
              <VehicleMap
                latitude={location.latitude}
                longitude={location.longitude}
                label={selectedVehicle.name}
              />
            ) : (
              <p className="dashboard-empty">No location data yet.</p>
            )}
          </div>

          <div className="card dashboard-chart">
            <h3>Distance, last 7 days</h3>
            <DistanceChart trips={trips} />
          </div>

          <div className="card dashboard-trips">
            <h3>Recent trips</h3>
            <TripList trips={displayedTrips} geofences={geofences} />
          </div>

          {recentAlerts.length > 0 && (
            <div className="card dashboard-alerts">
              <h3>Recent alerts</h3>
              <ul>
                {recentAlerts.map((alert) => (
                  <li key={alert.id}>
                    <strong>{alert.title}</strong> — {alert.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
