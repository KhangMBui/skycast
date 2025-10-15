import React, { useMemo, useCallback, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Tooltip as LeafTooltip,
  useMap,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import { Tooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./MapView.css";

export interface FlightPoint {
  lat: number;
  lon: number;
  alt?: number;
  t?: number;
  raw?: unknown;
  weather?: { temperature?: number; windspeed?: number } | null;
}
export interface Flight {
  id: string;
  points: FlightPoint[];
  latestIndex?: number;
}

interface MapViewProps {
  balloons: {
    id: string;
    lat: number;
    lon: number;
    alt?: number;
    weather?: { temperature?: number; windspeed?: number } | null;
  }[];
  flights?: Record<string, Flight>;
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
    onClusterClick,
    onMarkerClick,
  }: {
    balloons: {
      id: string;
      lat: number;
      lon: number;
      alt?: number;
      weather?: { temperature?: number; windspeed?: number } | null;
    }[];
    clusterIconFn: (cluster: any) => L.DivIcon;
    onClusterClick?: (cluster: any) => void;
    onMarkerClick?: (id: string) => void;
  }) {
    // iconCreateFunction runs with cluster object; we can compute summary and include as title for hover
    const iconCreateWrapper = (cluster: any) => {
      try {
        const children = cluster.getAllChildMarkers() || [];
        // compute averages by matching child lat/lon to balloons list
        let altSum = 0,
          altCount = 0;
        let windSum = 0,
          windCount = 0;
        let tempSum = 0,
          tempCount = 0;
        children.forEach((m: any) => {
          const lat = m.getLatLng().lat;
          const lon = m.getLatLng().lng;
          // find matching balloon (tolerance)
          const b = balloons.find(
            (x) => Math.abs(x.lat - lat) < 1e-6 && Math.abs(x.lon - lon) < 1e-6
          );
          if (!b) return;
          if (isFinite(Number(b.alt))) {
            altSum += b.alt ?? 0;
            altCount++;
          }
          if (b.weather?.windspeed !== undefined) {
            windSum += b.weather.windspeed;
            windCount++;
          }
          if (b.weather?.temperature !== undefined) {
            tempSum += b.weather.temperature;
            tempCount++;
          }
        });
        const avgAlt = altCount ? (altSum / altCount).toFixed(0) : "n/a";
        const avgWind = windCount ? (windSum / windCount).toFixed(1) : "n/a";
        const avgTemp = tempCount ? (tempSum / tempCount).toFixed(1) : "n/a";
        const title = `Count: ${children.length}\nAvg alt: ${avgAlt} m\nAvg temp: ${avgTemp}°C, Avg wind: ${avgWind} km/h`;
        // create icon (clusterIconFn will create the visual; we inject title here)
        const icon = clusterIconFn(cluster);
        // ensure title in html so native hover tooltip shows summary
        const el = (icon.options.html || "") as string;
        const html = el.replace(
          "<div",
          `<div title="${title.replace(/"/g, "&quot;")}"`
        );
        return L.divIcon({
          html,
          className: icon.options.className,
          iconSize: icon.options.iconSize,
        });
      } catch (e) {
        return clusterIconFn(cluster);
      }
    };
    return (
      <MarkerClusterGroup
        showCoverageOnHover={false}
        spiderfyOnMaxZoom={true}
        chunkedLoading={true}
        // chunked loading tuning - render markers in chunks to avoid jank
        chunkInterval={120}
        chunkDelay={40}
        chunkProgressiveIncrease={true}
        // keep clusters larger so we have fewer cluster markers at overview zooms
        maxClusterRadius={60}
        iconCreateFunction={iconCreateWrapper}
        onClusterClick={onClusterClick}
      >
        {balloons.map((b) => (
          <Marker
            key={b.id}
            position={[b.lat, b.lon]}
            icon={balloonIcon}
            eventHandlers={{
              click: () => onMarkerClick?.(b.id),
              // open lightweight tooltip on hover for immediate info
              mouseover: (e: any) => {
                try {
                  e.target.openTooltip();
                } catch {}
              },
              mouseout: (e: any) => {
                try {
                  e.target.closeTooltip();
                } catch {}
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <div style={{ minWidth: 140, fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>Balloon {b.id}</div>
                <div style={{ opacity: 0.9 }}>
                  Lat: {b.lat.toFixed(2)}, Lon: {b.lon.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: "#264653" }}>
                  Alt: {b.alt?.toFixed(0) ?? "n/a"} m
                </div>
                <div style={{ fontSize: 12, color: "#264653" }}>
                  {b.weather?.temperature !== undefined
                    ? `${b.weather.temperature}°C`
                    : "Temp n/a"}
                  {" · "}
                  {b.weather?.windspeed !== undefined
                    ? `${b.weather.windspeed} km/h`
                    : "Wind n/a"}
                </div>
              </div>
            </Tooltip>
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
  flights,
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

  const downsamplePoints = (pts: FlightPoint[], maxPoints = 400) => {
    if (!pts || pts.length <= maxPoints) return pts;
    const step = Math.ceil(pts.length / maxPoints);
    return pts.filter((_, i) => i % step === 0);
  };

  // Helper component: when provided positions, fit the map to their bounds (used in Focus Mode)
  function FitBounds({ positions }: { positions: [number, number][] | null }) {
    const map = useMap();
    useEffect(() => {
      if (!positions || positions.length === 0) return;
      try {
        const bounds = L.latLngBounds(positions as any);
        // pad a bit so polyline isn't flush to edge; cap max zoom to avoid going too deep
        map.fitBounds(bounds.pad ? bounds.pad(0.18) : bounds, {
          maxZoom: 8,
          animate: true,
        });
      } catch (e) {
        // ignore fit errors
      }
    }, [map, positions]);
    return null;
  }

  // selected flight polyline (downsampled for performance)
  const selectedFlightPositions = useMemo(() => {
    if (!selectedId || !flights) return null;
    const f = flights[selectedId];
    if (!f || !f.points || f.points.length === 0) return null;
    const pts = downsamplePoints(f.points, 600);
    return pts.map((p) => [p.lat, p.lon] as [number, number]);
  }, [selectedId, flights]);

  // cluster click behaviour (fit bounds)
  const handleClusterClick = useCallback((cluster: any) => {
    const bounds = cluster.layer?.getBounds?.();
    const map = cluster.target?._map;
    if (map && bounds) map.fitBounds(bounds.pad ? bounds.pad(0.8) : bounds);
  }, []);

  // selected flight detailed points (downsampled, keep weather if present)
  const selectedFlightDetailed = useMemo(() => {
    if (!selectedId || !flights) return null;
    const f = flights[selectedId];
    if (!f || !f.points || f.points.length === 0) return null;
    // downsample more finely for per-point markers (cap at 200)
    const maxPoints = 200;
    const step = Math.max(1, Math.ceil(f.points.length / maxPoints));
    return f.points.filter(
      (_, i) => i % step === 0 || i === f.points.length - 1
    );
  }, [selectedId, flights]);

  // small haversine helper to compute distance (km)
  const haversineKm = useCallback(
    (a: [number, number], b: [number, number]) => {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(b[0] - a[0]);
      const dLon = toRad(b[1] - a[1]);
      const lat1 = toRad(a[0]);
      const lat2 = toRad(b[0]);
      const sinDLat = Math.sin(dLat / 2);
      const sinDLon = Math.sin(dLon / 2);
      const aa =
        sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    },
    []
  );

  // metrics for selected flight: total distance (km), avg altitude (m), duration (hrs)
  const selectedFlightMetrics = useMemo(() => {
    if (!selectedId || !flights) return null;
    const f = flights[selectedId];
    if (!f || !f.points || f.points.length < 2) return null;
    const pts = f.points;
    let dist = 0;
    let altSum = 0;
    let altCount = 0;
    for (let i = 1; i < pts.length; i++) {
      dist += haversineKm(
        [pts[i - 1].lat, pts[i - 1].lon],
        [pts[i].lat, pts[i].lon]
      );
      if (isFinite(Number(pts[i].alt))) {
        altSum += pts[i].alt ?? 0;
        altCount++;
      }
    }
    // include first point altitude if present
    if (isFinite(Number(pts[0].alt))) {
      altSum += pts[0].alt ?? 0;
      altCount++;
    }
    const avgAlt = altCount ? Math.round(altSum / altCount) : null;
    const t0 = pts[0].t ?? pts[0].t === 0 ? pts[0].t : undefined;
    const t1 =
      pts[pts.length - 1].t ?? pts[pts.length - 1].t === 0
        ? pts[pts.length - 1].t
        : undefined;
    const durationHours =
      t0 && t1 ? Math.max(0, (t1 - t0) / (1000 * 60 * 60)) : null;
    return {
      distanceKm: Number(dist.toFixed(2)),
      avgAlt,
      durationHours:
        durationHours !== null ? Number(durationHours.toFixed(2)) : null,
      points: pts.length,
    };
  }, [selectedId, flights, haversineKm]);

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

        {!selectedId && (
          <MarkerClusterWrapper
            balloons={stableBalloons}
            clusterIconFn={createClusterIcon}
            onClusterClick={handleClusterClick}
            onMarkerClick={(id: string) => onSelect?.(id)}
          />
        )}

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
                  <LeafTooltip
                    direction="top"
                    offset={[0, -6]}
                    permanent={false}
                  >
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
                    </div>
                  </LeafTooltip>
                </Marker>

                {/* Fit map to selected trajectory */}
                {selectedFlightPositions && (
                  <FitBounds positions={selectedFlightPositions} />
                )}

                {/* red trajectory polyline for visibility */}
                {selectedFlightPositions && (
                  <Polyline
                    positions={selectedFlightPositions}
                    color="#ff4d4f"
                    weight={3}
                    opacity={0.95}
                  />
                )}
                {/* render per-point markers (downsampled) with tooltip showing time + weather */}
                {selectedFlightDetailed &&
                  selectedFlightDetailed.map((p, idx) => {
                    const ts = p.t ? new Date(p.t).toLocaleString() : "";
                    const weatherText =
                      p.weather?.temperature !== undefined ||
                      p.weather?.windspeed !== undefined
                        ? `Temp: ${p.weather?.temperature ?? "n/a"}°C · Wind: ${
                            p.weather?.windspeed ?? "n/a"
                          } km/h`
                        : "No weather";
                    return (
                      <CircleMarker
                        key={`pt-${selectedId}-${idx}`}
                        center={[p.lat, p.lon]}
                        radius={6}
                        pathOptions={{
                          color: "#ff4d4f",
                          fillColor: "#ff9999",
                          fillOpacity: 0.9,
                        }}
                      >
                        <LeafTooltip direction="top" offset={[0, -6]}>
                          <div style={{ minWidth: 140, fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{ts}</div>
                            <div style={{ opacity: 0.9 }}>
                              Alt:{" "}
                              {p.alt !== undefined
                                ? `${Math.round(p.alt)} m`
                                : "n/a"}
                            </div>
                            <div style={{ opacity: 0.85 }}>{weatherText}</div>
                          </div>
                        </LeafTooltip>
                      </CircleMarker>
                    );
                  })}
              </>
            );
          })()}
      </MapContainer>

      {/* overlay control shown only in Focus Mode */}
      {selectedId && (
        <>
          <div className="map-overlay">
            <button
              className="back-to-overview"
              onClick={(e) => {
                e.preventDefault();
                onClearSelection?.();
              }}
              aria-label="Back to overview"
            >
              ← Back to overview
            </button>
          </div>

          {/* analysis card in focus mode */}
          <div className="map-info" role="status" aria-live="polite">
            {selectedFlightMetrics ? (
              <>
                <div className="map-info-title">Flight analysis</div>
                <div>
                  Distance traveled: {selectedFlightMetrics.distanceKm} km
                </div>
                <div>
                  Average altitude:{" "}
                  {selectedFlightMetrics.avgAlt !== null
                    ? `${selectedFlightMetrics.avgAlt} m`
                    : "n/a"}
                </div>
                <div>
                  Duration:{" "}
                  {selectedFlightMetrics.durationHours !== null
                    ? `${selectedFlightMetrics.durationHours} h`
                    : "n/a"}{" "}
                  ({selectedFlightMetrics.points} points)
                </div>
              </>
            ) : (
              <div>No detailed trajectory available for analysis.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(MapView);
