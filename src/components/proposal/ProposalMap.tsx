import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapStop {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

const ProposalMap = ({ stops }: { stops: MapStop[] }) => {
  if (stops.length === 0) return null;

  return (
    <MapContainer
      center={[stops[0].lat, stops[0].lng]}
      zoom={7}
      className="h-full w-full"
      scrollWheelZoom={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
      {stops.map((stop, i) => (
        <Marker key={i} position={[stop.lat, stop.lng]}>
          <Popup>
            <strong>{stop.label}</strong><br />{stop.address}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default ProposalMap;
