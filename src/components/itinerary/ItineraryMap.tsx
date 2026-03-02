import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  dayNumber: number;
}

interface ItineraryMapProps {
  points: MapPoint[];
  className?: string;
}

const ItineraryMap = ({ points, className = '' }: ItineraryMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    // Clean up previous map
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const markers: L.Marker[] = [];
    const latlngs: L.LatLngExpression[] = [];

    points.forEach(point => {
      const icon = L.divIcon({
        html: `<div style="background: hsl(200, 98%, 39%); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${point.dayNumber}</div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([point.lat, point.lng], { icon })
        .addTo(map)
        .bindPopup(`<b>Dia ${point.dayNumber}</b><br/>${point.label}`);
      markers.push(marker);
      latlngs.push([point.lat, point.lng]);
    });

    // Draw route line
    if (latlngs.length > 1) {
      L.polyline(latlngs, {
        color: 'hsl(200, 98%, 39%)',
        weight: 2,
        opacity: 0.6,
        dashArray: '8, 8',
      }).addTo(map);
    }

    // Fit bounds with padding
    if (latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs as L.LatLngTuple[]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }

    mapInstance.current = map;

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [points]);

  if (points.length === 0) return null;

  return <div ref={mapRef} className={`w-full ${className}`} style={{ minHeight: '400px' }} />;
};

export default ItineraryMap;
