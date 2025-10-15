# Skycast — WindBorne Live Balloon Weather Tracker

Skycast visualizes recent WindBorne balloon telemetry and overlays simple weather for inspection. It aggregates the last 24 hourly telemetry files (00.json → 23.json), groups points into flights, shows each flight’s latest location, and lets users inspect a selected balloon’s full 24‑hour trajectory with per‑point popups (time, altitude, temperature, wind). Weather enrichment is performed on‑demand to avoid API rate limits.

## Features
- Aggregate and group 24 hourly WindBorne telemetry files into flights.
- Map view with marker clustering and hover tooltips for immediate info.
- Click a marker or a balloon card to enter Focus Mode: shows the balloon’s 24‑hour trajectory (red polyline) and per‑point markers.
- On‑demand weather enrichment for selected flight points (to avoid Open‑Meteo rate limits).
- Simple flight analytics in Focus Mode: total distance, average altitude, duration.
- Responsive UI with loading modal for friendly deploys on free tiers.

## How it works (overview)
- Backend (optional Express) proxies or serves the upstream telemetry JSONs.
- Frontend (Vite + React + react‑leaflet) calls an API helper that:
  - Loads 24 hourly files, normalizes points, groups into flights (explicit id or spatial matching).
  - Exposes latest positions for map overview.
  - On selection, derives the selected flight’s full 24‑hour trajectory and fetches weather for sampled points.

## Tech stack
- Frontend: React + Vite, TypeScript, react‑leaflet, leaflet.markercluster  
- Backend (optional): Node/Express server for proxying telemetry and serving the static build  
- Weather: Open‑Meteo (on‑demand, batched, cached)

## Quick start (local)
1. Install deps
```bash
npm ci
```
2. Start the backend (if present)
```bash
npm start
```
3. In another terminal, start frontend dev server
```bash
npm run dev
```
Open http://localhost:5173 to view the app. The backend listens on `process.env.PORT` and serves `/api/treasure/:hh` if configured.

## Build & deploy (Render recommended for full-stack)
- Build command (Render):
```bash
npm ci && npm run build
```
- Start command (Render):
```bash
npm start
```

Notes:
- If you host frontend and backend together (Render, Railway), the Express server serves the built `dist/` and proxies telemetry endpoints under `/api/treasure/:hh`.
- If you host only the static frontend (Vercel/Netlify), set environment variable `VITE_WIND_BORNE_UPSTREAM` to the upstream telemetry host (and ensure CORS), or add a serverless proxy for `/api/treasure`.

## Operational notes
- Open‑Meteo free tier has rate limits — the app fetches weather on demand (selected flight) with batching and caching. Re-enable or extend weather enrichment only with proper caching/rate controls.
- Tweak the spatial matching threshold in `src/api/windborne.ts` (`MATCH_KM`) if grouping is too aggressive or too fragmented.
