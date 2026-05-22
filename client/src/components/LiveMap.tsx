import { APIProvider, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';
import type { VehicleDto, ShipmentDto } from '@logistics/shared';
import { VehicleMarker } from './VehicleMarker';

const BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? '';
const MAP_ID = 'logistics-map';

const DEFAULT_CENTER = { lat: 39.5, lng: -98.35 };
const DEFAULT_ZOOM = 4;

interface Props {
  vehicles: VehicleDto[];
  shipments: ShipmentDto[];
  onVehicleClick?: (vehicleId: string) => void;
}

function riskForVehicle(vehicleId: string, shipments: ShipmentDto[]): number {
  const active = shipments.find(
    (s) => s.vehicleId === vehicleId && s.status === 'enroute',
  );
  return active?.riskScore ?? 0;
}

// Renders Google Maps Polylines and TrafficLayer via the native Maps JS API
function MapOverlays({ vehicles, shipments }: { vehicles: VehicleDto[]; shipments: ShipmentDto[] }) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);

  // Traffic layer — mount once
  useEffect(() => {
    if (!map || !mapsLib) return;
    if (!trafficRef.current) {
      trafficRef.current = new mapsLib.TrafficLayer();
      trafficRef.current.setMap(map);
    }
    return () => {
      trafficRef.current?.setMap(null);
    };
  }, [map, mapsLib]);

  // Route polylines — re-render whenever vehicles change
  useEffect(() => {
    if (!map || !mapsLib) return;
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    for (const v of vehicles) {
      if (!v.waypoints || v.waypoints.length < 2) continue;
      const active = shipments.find((s) => s.vehicleId === v.id && s.status === 'enroute');
      const risk = active?.riskScore ?? 0;

      const line = new mapsLib.Polyline({
        path: v.waypoints,
        geodesic: true,
        strokeColor: risk >= 80 ? '#ef4444' : risk >= 50 ? '#f97316' : '#3b82f6',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map,
      });
      polylinesRef.current.push(line);
    }

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
    };
  }, [map, mapsLib, vehicles, shipments]);

  return null;
}

export function LiveMap({ vehicles, shipments, onVehicleClick }: Props) {
  const activeVehicles = vehicles.filter((v) =>
    shipments.some((s) => s.vehicleId === v.id && s.status === 'enroute'),
  );

  return (
    <APIProvider apiKey={BROWSER_KEY}>
      <div className="w-full h-full rounded-lg overflow-hidden">
        <Map
          mapId={MAP_ID}
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: '100%', height: '100%' }}
        >
          <MapOverlays vehicles={vehicles} shipments={shipments} />
          {activeVehicles.map((v) => (
            <VehicleMarker
              key={v.id}
              vehicle={v}
              riskScore={riskForVehicle(v.id, shipments)}
              onClick={() => onVehicleClick?.(v.id)}
            />
          ))}
        </Map>
      </div>
    </APIProvider>
  );
}
