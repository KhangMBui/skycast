import React, { useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
// import cluster CSS from the underlying leaflet.markercluster package
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
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
  iconAnchor: [12, 12],
});

const MarkerClusterWrapper = React.memo(
  function MarkerClusterWrapper({
    balloons,
    clusterIconFn,
  }: {
    balloons: { id: string; lat: number; lon: number; alt?: number }[];
    clusterIconFn: (cluster: any) => L.DivIcon;
  }) {
    return (
      <MarkerClusterGroup
        showCoverageOnHover={false}
        spiderfyOnMaxZoom={true}
        chunkedLoading={true}
        iconCreateFunction={clusterIconFn}
      >
        {balloons.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lon]} icon={balloonIcon}>
            <Popup>
              <strong>Balloon {b.id}</strong>
              <br />
              Lat: {b.lat.toFixed(2)}, Lon: {b.lon.toFixed(2)}
              <br />
              Altitude: {b.alt?.toFixed(0)} m
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    );
  },
  // custom comparator: only re-render when count or (id,lat,lon) for any entry changes
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

const MapView: React.FC<MapViewProps> = ({ balloons }) => {
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

  // memoize markers to avoid re-creating Marker elements each render
  // const markers = useMemo(
  //   () =>
  //     balloons.map((b) => (
  //       <Marker key={b.id} position={[b.lat, b.lon]} icon={balloonIcon}>
  //         <Popup>
  //           <strong>Balloon {b.id}</strong>
  //           <br />
  //           Lat: {b.lat.toFixed(2)}, Lon: {b.lon.toFixed(2)}
  //           <br />
  //           Altitude: {b.alt?.toFixed(0)} m
  //           <br />
  //           Temp: {b.weather?.temperature ?? "?"}°C
  //           <br />
  //           Wind: {b.weather?.windspeed ?? "?"} km/h
  //         </Popup>
  //       </Marker>
  //     )),
  //   [balloons]
  // );

  // ensure a stable ordering for comparator: sort by id (do not mutate original)
  const stableBalloons = useMemo(() => {
    return [...balloons].sort((x, y) =>
      x.id < y.id ? -1 : x.id > y.id ? 1 : 0
    );
  }, [balloons]);

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
        <MarkerClusterWrapper
          balloons={stableBalloons}
          clusterIconFn={createClusterIcon}
        />
      </MapContainer>
    </div>
  );
};

export default React.memo(MapView);
