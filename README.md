# SAT Show Demo

Showcases how InfluxDB 3 handles fast, time-series ingestion by streaming NASA Near‑Earth Object (NEO) telemetry into a local IOx instance and visualizing it with a React + React Three Fiber dashboard.

## What it does

1. **Capture** – the server polls NASA's `/neo/feed` and `/neo/browse` APIs, normalizes each close-approach, and writes it to the `neo_flyby` measurement.
2. **Store** – InfluxDB 3 keeps tags/fields for each NEO (risk score, diameter, miss distance, etc.) with timestamps set to the approach epoch.
3. **Visualize** – the React app queries recent flybys, renders them on a textured 3D Earth with orbital markers, and summarizes trends in charts and list views.

## Tech stack

| Layer  | Tech |
| ------ | ---- |
| Ingestion/API | Node 20, Express, `@influxdata/influxdb3-client`, Axios |
| Storage | InfluxDB 3 Core (FlightSQL + write API) |
| UI | Vite + React + React Three Fiber + Recharts + vanilla CSS |

## Prerequisites

- Node.js 18+ installed on your machine
- InfluxDB 3 Core/Enterprise running locally (default `http://localhost:8181`)
- NASA API key
- InfluxDB token with write/query access to your database (`my_db` by default)
- The InfluxDB 3 TypeScript client is pulled in via `npm install`; no extra manual setup is needed.

## Setup

1. Copy the sample env file and fill in your NASA and Influx credentials:

   ```bash
   cp packages/server/.env.example packages/server/.env
   # edit packages/server/.env with NASA_API_KEY, INFLUX_URL, INFLUX_TOKEN, etc.
   ```

2. Install dependencies (this also installs the InfluxDB 3 client SDK):

   ```bash
   npm install
   ```

## Running locally

1. **Server & ingestion**

   ```bash
   npm run dev:server
   ```

   - Schedules automatic pulls every `INGEST_INTERVAL_MS` (default 5 min)
   - Serves REST endpoints on `http://localhost:4000`
     - `GET /api/neos` – recent approaches for the globe/list
     - `GET /api/summary` – daily/orbit aggregations
     - `POST /api/ingest` – manual "Capture now" trigger

2. **Client dashboard**

   ```bash
   npm run dev:client
   ```

   - Vite dev server runs at `http://localhost:5173`
   - Header controls:
     - **Capture now** → POST `/api/ingest` (button shows “Capturing…” until the call resolves)
     - **Refresh data** → Re-fetch `/api/neos` and `/api/summary`
     - **Date window picker** → shift the query window backward/forward 14 days or jump back to "today" to explore historical/future approaches.

## Building for distribution

```bash
npm run build
# packages/server/dist -> JS bundle for the API
# packages/client/dist -> Static assets for the dashboard
```

## Influx schema

Measurement `neo_flyby`:

- **Tags**: `neo_id`, `approach_id`, `orbiting_body`
- **Fields**: `name`, `hazardous`, `magnitude`, `diameter_km`, `velocity_kps`, `miss_distance_km`, `risk_score`, `reference_url`
- **Timestamp**: `epoch_date_close_approach`

Tune the ingestion windows or aggregation SQL in `packages/server/src/neoService.ts`.
