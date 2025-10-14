import React, { useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./MapView.css";

interface MapViewProps {
  balloons: {
    id: string;
    lat: number;
    lon: number;
    alt?: number;
    weather?: { temperature?: number; windspeed?: number } | null;
  }[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onClearSelection?: () => void;
}

const balloonIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/206/206542.png",
  iconSize: [25, 25],
  iconAnchor: [12, 12],
});

const MarkerClusterWrapper = React.memo(
  function MarkerClusterWrapper({
    balloons,
    clusterIconFn,
  }: {
    balloons: {
      id: string;
      lat: number;
      lon: number;
      alt?: number;
      weather?: { temperature?: number; windspeed?: number } | null;
    }[];
    clusterIconFn: (cluster: any) => L.DivIcon;
  }) {
    return (
      <MarkerClusterGroup
        showCoverageOnHover={false}
        spiderfyOnMaxZoom={true}
        chunkedLoading={true}
        iconCreateFunction={clusterIconFn}
      >
        +{" "}
        {balloons.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lon]} icon={balloonIcon}>
            {" "}
            <Popup>
              {" "}
              <div style={{ minWidth: 160 }}>
                <strong>Balloon {b.id}</strong>+{" "}
                <div>
                  Lat: {b.lat.toFixed(2)}, Lon: {b.lon.toFixed(2)}
                </div>
                <div>Alt: {b.alt?.toFixed(0) ?? "n/a"} m</div>
                <div>
                  Temp:{" "}
                  {b.weather?.temperature !== undefined
                    ? `${b.weather.temperature}°C`
                    : "n/a"}
                  {" · "}
                  Wind:{" "}
                  {b.weather?.windspeed !== undefined
                    ? `${b.weather.windspeed} km/h`
                    : "n/a"}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    );
  },
  // only re-render when count or (id,lat,lon) for any entry changes
  (prevProps, nextProps) => {
    const a = prevProps.balloons;
    const b = nextProps.balloons;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id) return false;
      if (a[i].lat !== b[i].lat || a[i].lon !== b[i].lon) return false;
    }
    return true; // no positional changes -> skip update
  }
);

const MapView: React.FC<MapViewProps> = ({
  balloons,
  selectedId,
  onSelect,
  onClearSelection,
}) => {
  const center: [number, number] = [20, 0]; // roughly central world view
  // console.log("Balloons: ", balloons);

  // custom cluster icon - clearer, themed circle with count
  const CLUSTER_SIZE = 44;
  const createClusterIcon = useCallback((cluster: any) => {
    const count = cluster.getChildCount();
    const html = `<div class="cluster-icon"><span>${count}</span></div>`;
    return L.divIcon({
      html,
      className: "custom-cluster",
      iconSize: L.point(CLUSTER_SIZE, CLUSTER_SIZE, true),
    });
  }, []);

  // ensure a stable ordering for comparator: sort by id (do not mutate original)
  const stableBalloons = useMemo(
    () => [...balloons].sort((a, b) => a.id.localeCompare(b.id)),
    [balloons]
  );

  // When selectedId is present, hide the MarkerClusterGroup and instead show only the selected marker + (optionally) its trajectory.
  // cluster click behaviour
  const handleClusterClick = useCallback((cluster: any) => {
    const bounds = cluster.layer.getBounds();
    const map = cluster.target._map;
    if (map && bounds) map.fitBounds(bounds.pad(0.8));
  }, []);

  return (
    <div className="map-wrapper">
      <MapContainer
        center={center}
        zoom={2}
        minZoom={2}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />

        {/* Overview/Cluster mode: only show when nothing selected */}
        {!selectedId && (
          <MarkerClusterWrapper
            balloons={stableBalloons}
            clusterIconFn={createClusterIcon}
            onClusterClick={handleClusterClick}
            onMarkerClick={(id: string) => onSelect?.(id)}
          />
        )}

        {/* Focus mode: show only selected marker (and later show full polyline for flight) */}
        {selectedId &&
          (() => {
            const s = stableBalloons.find((b) => b.id === selectedId);
            if (!s) return null;
            return (
              <>
                <Marker
                  position={[s.lat, s.lon]}
                  icon={balloonIcon}
                  eventHandlers={{ click: () => onSelect?.(s.id) }}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <strong>{s.id}</strong>
                      <div>
                        Lat: {s.lat.toFixed(2)}, Lon: {s.lon.toFixed(2)}
                      </div>
                      <div>Alt: {s.alt?.toFixed(0) ?? "n/a"} m</div>
                      <div>
                        Temp:{" "}
                        {s.weather?.temperature !== undefined
                          ? `${s.weather.temperature}°C`
                          : "n/a"}
                        {" · "}
                        Wind:{" "}
                        {s.weather?.windspeed !== undefined
                          ? `${s.weather.windspeed} km/h`
                          : "n/a"}
                      </div>
                      <br />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          onClearSelection?.();
                        }}
                      >
                        Back to overview
                      </button>
                    </div>
                  </Popup>
                </Marker>
                {/* TODO: draw full trajectory polyline here once flights data available */}
              </>
            );
          })()}
      </MapContainer>
    </div>
  );
};

export default React.memo(MapView);
