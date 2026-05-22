import { AdvancedMarker } from '@vis.gl/react-google-maps';
import type { VehicleDto } from '@logistics/shared';

interface Props {
  vehicle: VehicleDto;
  riskScore: number;
  onClick?: () => void;
}

function riskColor(score: number): string {
  if (score >= 80) return '#ef4444'; // red
  if (score >= 50) return '#f97316'; // orange
  return '#22c55e'; // green
}

export function VehicleMarker({ vehicle, riskScore, onClick }: Props) {
  const color = riskColor(riskScore);
  const isMoving = vehicle.speedKph > 0;

  return (
    <AdvancedMarker
      position={{ lat: vehicle.currentLat, lng: vehicle.currentLng }}
      onClick={onClick}
    >
      <div className="relative flex flex-col items-center cursor-pointer group">
        {/* Pulse ring when risk is high */}
        {riskScore >= 80 && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ backgroundColor: color }} />
        )}

        {/* Truck icon */}
        <div
          className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 border-white shadow-lg text-white font-bold text-xs"
          style={{ backgroundColor: color }}
        >
          {vehicle.label.charAt(0)}
        </div>

        {/* Label bubble */}
        <div className="mt-1 px-2 py-0.5 rounded bg-gray-900/90 text-white text-xs whitespace-nowrap shadow">
          {vehicle.label}
          {isMoving && <span className="ml-1 text-gray-400">{Math.round(vehicle.speedKph)}kph</span>}
          {!isMoving && <span className="ml-1 text-orange-400">stopped</span>}
        </div>
      </div>
    </AdvancedMarker>
  );
}
