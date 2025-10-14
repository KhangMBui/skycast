import { useEffect, useMemo, useState } from "react";
import { fetchWindborneData } from "./api/windborne";
import BalloonList from "./components/BalloonList";
import MapView from "./components/MapView";
import { fetchWeather } from "./api/openMeteo";
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

function App() {
  const [balloons, setBalloons] = useState<CombinedBalloon[]>([]);
  const [loading, setLoading] = useState(true);

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

  // useEffect(() => {
  //   (async () => {
  //     const wbData = await fetchWindborneData();
  //     setBalloons(wbData);
  //     setLoading(false);
  //     // progressive weather enrichment omitted for brevity...
  //   })();
  // }, []);

  useEffect(() => {
    (async () => {
      const wbData = await fetchWindborneData(); // full dataset (all parsed balloons)

      // show full list immediately (no weather)
      setBalloons(wbData);
      setLoading(false);
      // progressively fetch weather for each balloon's latest point with limited concurrency
      const CONCURRENCY = 4;
      for (let i = 0; i < wbData.length; i += CONCURRENCY) {
        const chunk = wbData.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          chunk.map(async (b) => {
            try {
              const w = await fetchWeather(b.lat, b.lon);
              return { id: b.id, weather: w ?? undefined };
            } catch {
              return { id: b.id, weather: undefined };
            }
          })
        );

        // merge results into current state (only update entries that changed)
        setBalloons((prev) =>
          prev.map((p) => {
            const found = results.find((r) => r.id === p.id);
            return found ? { ...p, weather: found.weather } : p;
          })
        );

        // gentle delay to avoid spamming the weather API
        await new Promise((r) => setTimeout(r, 250));
      }
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

      <MapView
        balloons={mapBalloons}
        selectedId={selectedId}
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
