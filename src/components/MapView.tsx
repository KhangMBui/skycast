import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "./MapView.css";

interface MapViewProps {
  balloons: {
    id: string;
    lat: number;
    lon: number;
    alt: number;
    weather?: {
      temperature: number;
      windspeed: number;
    };
  }[];
}

const balloonIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/206/206542.png",
  iconSize: [25, 25],
});

const MapView: React.FC<MapViewProps> = ({ balloons }) => {
  const center: [number, number] = [20, 0]; // roughly central world view
  console.log("Balloons: ", balloons);
  return (
    <div className="map-wrapper">
      <MapContainer
        center={center}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        {balloons.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lon]} icon={balloonIcon}>
            <Popup>
              <strong>Balloon {b.id}</strong>
              <br />
              Altitude: {b.alt?.toFixed(0)} m<br />
              Temp: {b.weather?.temperature ?? "?"}°C
              <br />
              Wind: {b.weather?.windspeed ?? "?"} km/h
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
