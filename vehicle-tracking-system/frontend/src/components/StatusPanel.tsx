import type { Vehicle, VehicleStatus } from '../api/types';
import { formatKm, formatTimeAgo } from '../lib/format';
import { CarIcon, DistanceIcon, RouteIcon, SpeedIcon } from './icons';
import './StatusPanel.css';

interface StatusPanelProps {
  vehicle: Vehicle;
  status: VehicleStatus;
  speedKmh: number | null;
  todayTrips: number;
  todayDistanceKm: number;
  deviceOnline: boolean;
  deviceLastSeenAt: string | null;
}

type Mood = 'good' | 'warning' | 'critical';

function resolveMood(
  status: VehicleStatus,
  deviceOnline: boolean,
  isMoving: boolean,
): { mood: Mood; label: string } {
  if (status === 'INACTIVE') {
    return { mood: 'warning', label: 'Inactive' };
  }
  if (!deviceOnline) {
    return { mood: 'critical', label: 'Device offline' };
  }
  if (isMoving) {
    return { mood: 'good', label: 'Moving' };
  }
  return { mood: 'warning', label: 'Parked' };
}

export function StatusPanel({
  vehicle,
  status,
  speedKmh,
  todayTrips,
  todayDistanceKm,
  deviceOnline,
  deviceLastSeenAt,
}: StatusPanelProps) {
  const isMoving = (speedKmh ?? 0) > 0;
  const { mood, label } = resolveMood(status, deviceOnline, isMoving);
  const subtitle = [vehicle.make, vehicle.model, vehicle.registrationNumber]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="status-panel">
      <div className="status-panel-header">
        <div className="status-panel-icon" aria-hidden>
          <CarIcon size={22} />
        </div>
        <div>
          <h2>{vehicle.name}</h2>
          {subtitle && <p className="status-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className={`status-pill status-pill--${mood}`}>
        <span className="status-pill-dot" aria-hidden />
        {label}
        {!deviceOnline && deviceLastSeenAt && (
          <span className="status-pill-detail">· seen {formatTimeAgo(deviceLastSeenAt)}</span>
        )}
      </div>

      <div className="status-metrics">
        <div className="status-metric">
          <div className="status-metric-icon" aria-hidden>
            <SpeedIcon />
          </div>
          <div>
            <span className="metric-value">{speedKmh != null ? Math.round(speedKmh) : '—'}</span>
            <span className="metric-label">km/h</span>
          </div>
        </div>
        <div className="status-metric">
          <div className="status-metric-icon" aria-hidden>
            <RouteIcon />
          </div>
          <div>
            <span className="metric-value">{todayTrips}</span>
            <span className="metric-label">trips today</span>
          </div>
        </div>
        <div className="status-metric">
          <div className="status-metric-icon" aria-hidden>
            <DistanceIcon />
          </div>
          <div>
            <span className="metric-value">{formatKm(todayDistanceKm)}</span>
            <span className="metric-label">today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
