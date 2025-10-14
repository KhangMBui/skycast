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

  useEffect(() => {
    (async () => {
      const wbData = await fetchWindborneData(); // full dataset (all parsed balloons)

      // show full list immediately (no weather)
      setBalloons(wbData);
      setLoading(false);

      // progressively fetch weather for all balloons with limited concurrency
      const CONCURRENCY = 4;
      const ids = [...wbData];
      for (let i = 0; i < ids.length; i += CONCURRENCY) {
        const chunk = ids.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          chunk.map(async (b) => {
            const w = await fetchWeather(b.lat, b.lon);
            return { id: b.id, weather: w ?? undefined };
          })
        );

        // merge results into current state (preserve other entries)
        setBalloons((prev) =>
          prev.map((p) => {
            const found = results.find((r) => r.id === p.id);
            return found ? { ...p, weather: found.weather } : p;
          })
        );
        // optional small delay to be gentle with upstream API
        await new Promise((r) => setTimeout(r, 250));
      }
    })();
  }, []);

  if (loading) return <div className="loading">Loading balloons...</div>;

  return (
    <div className="App">
      <h1>🌎🎈 Skycast - WindBorne Live Balloon Weather Tracker</h1>
      <p>
        Tracking real-time balloon positions with live weather data from
        Open-Meteo.
      </p>

      <MapView balloons={mapBalloons} />

      <h2>All Balloons</h2>
      <BalloonList balloons={balloons} />
    </div>
  );
}

export default App;
