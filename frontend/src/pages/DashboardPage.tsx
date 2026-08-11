import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { endpoints } from '../api/endpoints';
import { useVehicleSocket } from '../socket/useVehicleSocket';
import { StatusPanel } from '../components/StatusPanel';
import { TripList } from '../components/TripList';
import { VehicleMap } from '../components/VehicleMap';
import type { DashboardSummary, Trip, Vehicle } from '../api/types';
import './DashboardPage.css';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { liveLocation, liveTrip, recentAlerts } = useVehicleSocket(selectedVehicleId);

  useEffect(() => {
    endpoints.listVehicles().then((list) => {
      setVehicles(list);
      setSelectedVehicleId((current) => current ?? list[0]?.id ?? null);
    });
  }, []);

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
      .finally(() => setIsLoading(false));
  }, [selectedVehicleId]);

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

      {isLoading && <p className="dashboard-loading">Loading…</p>}

      {!isLoading && !selectedVehicle && (
        <p className="dashboard-empty">
          No vehicles yet. Create one via the API to get started.
        </p>
      )}

      {!isLoading && selectedVehicle && summary && (
        <div className="dashboard-grid">
          <div className="card dashboard-status">
            <StatusPanel
              vehicle={selectedVehicle}
              status={summary.vehicleStatus}
              speedKmh={speedKmh}
              todayTrips={summary.todayTrips}
              todayDistanceKm={summary.todayDistanceKm}
              deviceOnline={summary.deviceStatus?.online ?? false}
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

          <div className="card dashboard-trips">
            <h3>Recent trips</h3>
            <TripList trips={displayedTrips} />
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
