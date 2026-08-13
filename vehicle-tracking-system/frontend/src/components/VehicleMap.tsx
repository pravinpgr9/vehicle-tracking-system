import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_ZOOM = 15;

const vehicleIcon = new DivIcon({
  className: 'vehicle-marker',
  html: '<span></span>',
  iconSize: [16, 16],
});

interface VehicleMapProps {
  latitude: number;
  longitude: number;
  label: string;
}

/**
 * Thin Leaflet/OpenStreetMap wrapper. Callers only depend on this
 * component's props, not on Leaflet directly — swapping map providers
 * later (e.g. Google Maps) means changing this file, not its call sites.
 */
function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude]);
  }, [map, latitude, longitude]);
  return null;
}

export function VehicleMap({ latitude, longitude, label }: VehicleMapProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={vehicleIcon}>
        <Tooltip permanent direction="top" offset={[0, -8]}>
          {label}
        </Tooltip>
      </Marker>
      <Recenter latitude={latitude} longitude={longitude} />
    </MapContainer>
  );
}
