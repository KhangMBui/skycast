export interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode?: number;
}

const cache = new Map<string, WeatherData | null>();

function keyFor(lat: number, lon: number) {
  // round to 2 decimal places to reuse nearby points
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

async function fetchWithTimeout(url: string, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchWeather(
  lat: number,
  lon: number,
  retries = 2
): Promise<WeatherData | null> {
  const k = keyFor(lat, lon);
  if (cache.has(k)) return cache.get(k)!;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, 9000);
      if (!res.ok) {
        console.warn(`[openMeteo] status ${res.status} for ${k}`);
        continue;
      }
      const data = await res.json();
      const cw = data?.current_weather;
      if (!cw) {
        console.warn(`[openMeteo] no current_weather for ${k}`, data);
        cache.set(k, null);
        return null;
      }
      const out: WeatherData = {
        temperature: Number(cw.temperature ?? cw.temperature_2m ?? NaN),
        windspeed: Number(cw.windspeed ?? cw.windspeed_10m ?? NaN),
        weathercode: Number(cw.weathercode ?? -1),
      };
      cache.set(k, out);
      return out;
    } catch (err) {
      console.warn(
        `[openMeteo] fetch error ${attempt} for ${k}:`,
        (err as Error).message
      );
      // small backoff before retry
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  cache.set(k, null);
  return null;
}
