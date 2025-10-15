import { useEffect, useMemo, useState } from "react";
import { fetchLast24Hours } from "./api/windborne";
import BalloonList from "./components/BalloonList";
import MapView from "./components/MapView";
import { fetchWeather } from "./api/openMeteo";
import { type Flight } from "./components/MapView";
import "./App.css";

interface CombinedBalloon {
  id: string;
  lat: number;
  lon: number;
  alt: number;
  weather?: {
    temperature: number;
    windspeed: number;
  };
}

// interface FlightPoint {
//   lat: number;
//   lon: number;
//   alt?: number;
//   t?: number;
//   raw?: unknown;
//   weather?: { temperature?: number; windspeed?: number } | null;
// }
// interface Flight {
//   id: string;
//   points: FlightPoint[];
//   latestIndex?: number;
// }

function App() {
  const [balloons, setBalloons] = useState<CombinedBalloon[]>([]);
  const [loading, setLoading] = useState(true);
  const [flights, setFlights] = useState<Record<string, Flight>>({});

  // selection (Focus Mode)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Pass a stable, memoized array to MapView so it doesn't re-render unnecessarily.
  const mapBalloons = useMemo(
    () =>
      balloons.map((b) => ({
        id: b.id,
        lat: b.lat,
        lon: b.lon,
        alt: b.alt,
        weather: b.weather,
      })),
    [balloons]
  );

  // when a balloon is selected, fetch sparse weather for that flight (on-demand)
  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      const f = flights[selectedId];
      if (!f || !f.points || f.points.length === 0) return;

      // If already enriched (first point has weather), skip
      if (f.points.some((p) => p.weather !== undefined)) return;

      const MAX_POINTS = 24; // how many points to fetch weather for (tune)
      const step = Math.max(1, Math.floor(f.points.length / MAX_POINTS));
      // build indices to fetch (include last point)
      const indices: number[] = [];
      for (let i = 0; i < f.points.length; i += step) indices.push(i);
      if (indices[indices.length - 1] !== f.points.length - 1)
        indices.push(f.points.length - 1);

      // batch with limited concurrency
      const CONCURRENCY = 4;
      const batches: number[][] = [];
      for (let i = 0; i < indices.length; i += CONCURRENCY)
        batches.push(indices.slice(i, i + CONCURRENCY));

      for (const batch of batches) {
        const results = await Promise.all(
          batch.map(async (idx) => {
            const pt = f.points[idx];
            try {
              const w = await fetchWeather(pt.lat, pt.lon);
              return { idx, weather: w ?? undefined };
            } catch {
              return { idx, weather: undefined };
            }
          })
        );

        // merge into flights state immutably
        setFlights((prev) => {
          const cur = prev[selectedId];
          if (!cur) return prev;
          const newPoints = cur.points.slice();
          for (const r of results) {
            newPoints[r.idx] = { ...newPoints[r.idx], weather: r.weather };
          }
          return { ...prev, [selectedId]: { ...cur, points: newPoints } };
        });

        // also update latest balloon summary (so BalloonList & map tooltip show temperature/wind if last point included)
        setBalloons((prev) =>
          prev.map((b) => {
            if (b.id !== selectedId) return b;
            // try to pick the last point's weather if we fetched it
            const lastIdx = f.latestIndex ?? f.points.length - 1;
            const updatedPoint = results.find((r) => r.idx === lastIdx);
            const weather = updatedPoint ? updatedPoint.weather : undefined;
            return weather ? { ...b, weather } : b;
          })
        );

        // small delay between batches to be kind to API
        await new Promise((r) => setTimeout(r, 300));
      }
    })();
  }, [selectedId, flights, setFlights, setBalloons]);

  // useEffect(() => {
  //   (async () => {
  //     const wbData = await fetchWindborneData();
  //     setBalloons(wbData);
  //     setLoading(false);
  //     // progressive weather enrichment omitted for brevity...
  //   })();
  // }, []);

  // useEffect(() => {
  //   (async () => {
  //     const wbData = await fetchWindborneData(); // full dataset (all parsed balloons)

  //     // show full list immediately (no weather)
  //     setBalloons(wbData);
  //     setLoading(false);
  //     // progressively fetch weather for each balloon's latest point with limited concurrency
  //     const CONCURRENCY = 4;
  //     for (let i = 0; i < wbData.length; i += CONCURRENCY) {
  //       const chunk = wbData.slice(i, i + CONCURRENCY);
  //       const results = await Promise.all(
  //         chunk.map(async (b) => {
  //           try {
  //             const w = await fetchWeather(b.lat, b.lon);
  //             return { id: b.id, weather: w ?? undefined };
  //           } catch {
  //             return { id: b.id, weather: undefined };
  //           }
  //         })
  //       );

  //       // merge results into current state (only update entries that changed)
  //       setBalloons((prev) =>
  //         prev.map((p) => {
  //           const found = results.find((r) => r.id === p.id);
  //           return found ? { ...p, weather: found.weather } : p;
  //         })
  //       );

  //       // gentle delay to avoid spamming the weather API
  //       await new Promise((r) => setTimeout(r, 250));
  //     }
  //   })();
  // }, []);

  useEffect(() => {
    (async () => {
      // fetch aggregated 24-hour flights
      const flightsRecord = await fetchLast24Hours();
      setFlights(flightsRecord);

      // derive latest positions array immediately (no weather yet)
      const latest = Object.values(flightsRecord).map((f) => {
        const last = f.points[f.latestIndex ?? f.points.length - 1];
        return {
          id: f.id,
          lat: last.lat,
          lon: last.lon,
          alt: last.alt ?? 0,
        } as CombinedBalloon;
      });
      setBalloons(latest);
      setLoading(false);

      // NOTE: weather enrichment (Open-Meteo) is paused to avoid "Too many requests".
      // If you want progressive weather later, re-enable here with a small concurrency
      // and caching, or fetch weather on-demand when a balloon is selected

      // progressively fetch weather for latest points (limited concurrency)
      // const CONCURRENCY = 4;
      // for (let i = 0; i < latest.length; i += CONCURRENCY) {
      //   const chunk = latest.slice(i, i + CONCURRENCY);
      //   const results = await Promise.all(
      //     chunk.map(async (b) => {
      //       try {
      //         const w = await fetchWeather(b.lat, b.lon);
      //         return { id: b.id, weather: w ?? undefined };
      //       } catch {
      //         return { id: b.id, weather: undefined };
      //       }
      //     })
      //   );
      //   setBalloons((prev) =>
      //     prev.map((p) => {
      //       const found = results.find((r) => r.id === p.id);
      //       return found ? { ...p, weather: found.weather } : p;
      //     })
      //   );
      //   await new Promise((r) => setTimeout(r, 250));
      // }
    })();
  }, []);

  const handleSelectBalloon = (id: string) => setSelectedId(id);
  const handleClearSelection = () => setSelectedId(null);

  if (loading) return <div className="loading">Loading balloons...</div>;

  return (
    <div className="App">
      <h1>🌎🎈 Skycast - WindBorne Live Balloon Weather Tracker</h1>
      <p>
        Tracking real-time balloon positions with live weather data from
        Open-Meteo.
      </p>

      {!selectedId && (
        <div className="map-instructions" role="note">
          Showing latest balloon locations (one per flight). Click any marker or
          a balloon card to view its 24‑hour trajectory, altitude, temperature
          and windspeed. Use "Back to overview" to return.
        </div>
      )}

      <MapView
        balloons={mapBalloons}
        selectedId={selectedId}
        flights={flights}
        onSelect={handleSelectBalloon}
        onClearSelection={handleClearSelection}
      />

      <h2>All Balloons</h2>
      <BalloonList
        balloons={balloons}
        pageSize={30}
        onSelect={handleSelectBalloon}
        selectedId={selectedId}
      />
    </div>
  );
}

export default App;
