import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { DivIcon, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './VehicleMap.css';

const DEFAULT_ZOOM = 15;
const ANIMATION_MS = 900;

// Speed is shown as a fixed status scale (calm/cruising/fast), not a
// continuous gradient, so it reuses the app's reserved good/warning/critical
// meaning instead of inventing a new hue ramp. Thresholds are approximate
// city/highway/overspeed bands (the backend's own default overspeed limit is
// 80 km/h — see OVERSPEED_LIMIT_KMH).
const SPEED_BANDS = [
  { max: 40, className: 'good', label: 'Calm', hint: '< 40 km/h' },
  { max: 80, className: 'warning', label: 'Cruising', hint: '40–80 km/h' },
  { max: Infinity, className: 'critical', label: 'Fast', hint: '> 80 km/h' },
] as const;

type SpeedBand = (typeof SPEED_BANDS)[number];

function speedBand(speedKmh: number): SpeedBand {
  return SPEED_BANDS.find((band) => speedKmh <= band.max) ?? SPEED_BANDS[SPEED_BANDS.length - 1];
}

export interface TrailPoint {
  latitude: number;
  longitude: number;
  speed: number | null;
}

interface VehicleMapProps {
  latitude: number;
  longitude: number;
  heading?: number | null;
  label: string;
  trail?: TrailPoint[];
}

function vehicleIcon(heading: number | null | undefined): DivIcon {
  const hasHeading = typeof heading === 'number';
  return new DivIcon({
    className: 'vehicle-marker-wrap',
    html: hasHeading
      ? `<span class="vehicle-marker vehicle-marker--heading" style="transform: rotate(${heading}deg)"></span>`
      : '<span class="vehicle-marker"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** Smoothly interpolates the marker's displayed position between GPS pings instead of snapping. */
function useAnimatedPosition(latitude: number, longitude: number): [number, number] {
  const [displayed, setDisplayed] = useState<[number, number]>([latitude, longitude]);
  const fromRef = useRef<[number, number]>([latitude, longitude]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to: [number, number] = [latitude, longitude];
    if (from[0] === to[0] && from[1] === to[1]) {
      return;
    }
    const start = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      // Ease-out: fast start, settles into the new fix rather than a linear crawl.
      const eased = 1 - (1 - t) ** 3;
      setDisplayed([
        from[0] + (to[0] - from[0]) * eased,
        from[1] + (to[1] - from[1]) * eased,
      ]);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  return displayed;
}

function FollowController({
  latitude,
  longitude,
  follow,
  onUserPanned,
}: {
  latitude: number;
  longitude: number;
  follow: boolean;
  onUserPanned: () => void;
}) {
  const map = useMap();
  useMapEvents({ dragstart: onUserPanned });
  useEffect(() => {
    if (follow) {
      map.flyTo([latitude, longitude], map.getZoom(), { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, follow]);
  return null;
}

interface TrailSegment {
  positions: LatLngExpression[];
  band: SpeedBand;
}

function trailSegments(trail: TrailPoint[]): TrailSegment[] {
  const segments: TrailSegment[] = [];
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const band = speedBand(Math.max(a.speed ?? 0, b.speed ?? 0));
    const last = segments.at(-1);
    if (last && last.band === band) {
      last.positions.push([b.latitude, b.longitude]);
    } else {
      segments.push({
        positions: [
          [a.latitude, a.longitude],
          [b.latitude, b.longitude],
        ],
        band,
      });
    }
  }
  return segments;
}

/**
 * Thin Leaflet/OpenStreetMap wrapper. Callers only depend on this
 * component's props, not on Leaflet directly — swapping map providers
 * later (e.g. Google Maps) means changing this file, not its call sites.
 */
export function VehicleMap({ latitude, longitude, heading, label, trail = [] }: VehicleMapProps) {
  const [displayLat, displayLng] = useAnimatedPosition(latitude, longitude);
  const [follow, setFollow] = useState(true);
  const icon = useMemo(() => vehicleIcon(heading), [heading]);
  const segments = useMemo(() => trailSegments(trail), [trail]);

  return (
    <div className="vehicle-map">
      <MapContainer
        center={[displayLat, displayLng]}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {segments.map((segment, i) => (
          <Fragment key={i}>
            <Polyline
              positions={segment.positions}
              pathOptions={{ className: 'vehicle-trail-halo', weight: 7, lineCap: 'round' }}
            />
            <Polyline
              positions={segment.positions}
              pathOptions={{
                className: `vehicle-trail vehicle-trail--${segment.band.className}`,
                weight: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Fragment>
        ))}
        <Marker position={[displayLat, displayLng]} icon={icon}>
          <Tooltip permanent direction="top" offset={[0, -10]}>
            {label}
          </Tooltip>
        </Marker>
        <FollowController
          latitude={latitude}
          longitude={longitude}
          follow={follow}
          onUserPanned={() => setFollow(false)}
        />
      </MapContainer>

      {!follow && (
        <button type="button" className="map-recenter-btn" onClick={() => setFollow(true)}>
          Recenter
        </button>
      )}

      <div className="map-legend" role="note" aria-label="Trail speed key">
        {SPEED_BANDS.map((band) => (
          <span key={band.label} className={`map-legend-item map-legend-item--${band.className}`}>
            <span className="map-legend-dot" aria-hidden />
            {band.label}
            <span className="map-legend-hint">{band.hint}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
