export interface BalloonData {
  id: string;
  lat: number;
  lon: number;
  alt: number;
  raw?: unknown;
}

// Helper: try to parse numeric coordinates from a raw balloon object or array
function extractCoords(b: unknown) {
  // handle array form: [lat, lon, alt]
  if (Array.isArray(b)) {
    const lat = Number(b[0]);
    const lon = Number(b[1]);
    const alt = Number(b[2] ?? 0);
    return { lat, lon, alt };
  }

  if (typeof b !== "object" || b === null)
    return { lat: NaN, lon: NaN, alt: 0 };
  const obj = b as Record<string, unknown>;
  const lat = Number(
    obj["lat"] ?? obj["latitude"] ?? obj["lat_dd"] ?? obj["Lat"] ?? obj["LAT"]
  );
  const lon = Number(
    obj["lon"] ?? obj["longitude"] ?? obj["lon_dd"] ?? obj["Lon"] ?? obj["LON"]
  );
  const alt = Number(
    obj["alt"] ?? obj["altitude"] ?? obj["height"] ?? obj["h"] ?? 0
  );
  return { lat, lon, alt };
}

function makeId(b: unknown, idx: number) {
  if (Array.isArray(b)) {
    const maybeLat = String(b[0] ?? "n");
    const maybeLon = String(b[1] ?? "n");
    return `arr-${maybeLat}_${maybeLon}_${idx}`;
  }
  if (typeof b !== "object" || b === null) return `unknown-${idx}`;
  const obj = b as Record<string, unknown>;
  return String(
    obj["id"] ??
      obj["uid"] ??
      obj["name"] ??
      obj["label"] ??
      `${obj["lat"] ?? "n"}_${obj["lon"] ?? "n"}_${idx}`
  );
}

async function tryFetchJson(url: string) {
  try {
    console.debug(`[windborne] trying fetch: ${url}`);
    const res = await fetch(url, { cache: "no-store" });
    console.debug(`[windborne] ${url} status=${res.status}`);
    if (!res.ok) return null;
    const text = await res.text();
    // try parse JSON, but log raw text if parse fails
    try {
      const json = JSON.parse(text);
      console.debug(
        `[windborne] parsed JSON from ${url} (type=${typeof json})`
      );
      // show small sample for debugging
      if (Array.isArray(json)) {
        console.debug(
          `[windborne] sample length=${json.length} sample=`,
          json.slice(0, 3)
        );
      } else if (json && typeof json === "object") {
        console.debug(
          `[windborne] sample keys=`,
          Object.keys(json).slice(0, 10)
        );
      }
      return json;
    } catch (e) {
      console.warn(
        `Error: ${e}. [windborne] failed to parse JSON from ${url} — raw text (first 400 chars):\n`,
        text.slice(0, 400)
      );
      return null;
    }
  } catch (err) {
    console.warn(`[windborne] fetch error for ${url}:`, (err as Error).message);
    return null;
  }
}

export async function fetchWindborneData(): Promise<BalloonData[]> {
  // Rely only on proxied endpoints:
  // - /windborne/... uses Vite dev proxy (dev)
  // - /api/... is for your production server/proxy (same-origin)
  const candidates = [
    "/windborne/treasure/23.json", // Vite dev proxy -> https://a.windbornesystems.com/treasure/00.json
    "/api/treasure/23", // production proxy (serverless or backend)
  ];

  let raw: unknown = null;

  for (const c of candidates) {
    raw = await tryFetchJson(c);
    if (raw) {
      console.debug(`[windborne] loaded data from candidate ${c}`);
      break;
    } else {
      console.debug(`[windborne] candidate ${c} returned null`);
    }
  }

  if (!raw) {
    console.warn(
      "[windborne] no data loaded from proxies (all attempts failed)"
    );
    return [];
  }

  console.debug(
    "[windborne] raw type:",
    Array.isArray(raw) ? "array" : typeof raw
  );

  // The API sometimes returns an object or array; normalize to array
  let items: unknown[] = [];
  if (Array.isArray(raw)) {
    items = raw as unknown[];
  } else if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as Record<string, unknown>)["balloons"])
  ) {
    items = (raw as Record<string, unknown>)["balloons"] as unknown[];
  } else if (raw && typeof raw === "object") {
    items = Object.values(raw as Record<string, unknown>);
  }

  console.debug(
    `[windborne] normalized items length=${items.length} (showing first 5):`,
    items.slice(0, 5)
  );

  const byId = new Map<string, BalloonData & { t?: number }>();

  items.forEach((b, idx) => {
    if (!b) return;
    const { lat, lon, alt } = extractCoords(b);
    if (!isFinite(lat) || !isFinite(lon)) {
      if (idx < 10)
        console.debug(`[windborne] skipped item[${idx}] invalid coords:`, b);
      return;
    }
    const id = makeId(b, idx);

    // try to get a timestamp if available for sorting
    const bb = b as Record<string, unknown>;
    const t = Number(bb["t"] ?? bb["timestamp"] ?? bb["time"] ?? Date.now());

    const existing = byId.get(id);
    if (!existing || (existing.t ?? 0) < t) {
      const entry: BalloonData & { t?: number } = {
        id,
        lat,
        lon,
        alt,
        raw: b,
        t,
      };
      byId.set(id, entry);
    }
  });

  const arr = Array.from(byId.values()).map((v) => ({
    id: v.id,
    lat: v.lat,
    lon: v.lon,
    alt: v.alt,
    raw: v.raw,
  }));
  console.debug(
    "[windborne] final parsed balloon count=",
    arr.length,
    arr.slice(0, 6)
  );
  return arr;
}
