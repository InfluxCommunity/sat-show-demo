## SAT Show Demo

**Mocking the LeoLabs Sat visualization with custom dashboard powered by InfluxDB 3.**

Demo to accompany LEO Labs visulization (https://platform.leolabs.space/visualizations/leo), their feed uses proprietary telemetry, ours is synthetic/mocked but looks and feels the same, proving that InfluxDB 3 can ingest, query and visualize large volumes of orbital traffic in real time.

---

### Requirements

- Node version 20.19+ (or 22.12+) as Vite 7 needs it.
- Local InfluxDB 3 Core/Enterprise with a database called `my_demo_db`.
- Influx token with write + query rights.
- InfluxDB UI Explorer (optional) connected to InfluxDB 3 instance.
- _(Optional)_ NASA API key if you want to keep the legacy NEO ingest running in the background.

---

### 1. Configure once

```bash
cp packages/server/.env.example packages/server/.env
# edit the file with:
#   NASA_API_KEY    (optional)
#   INFLUX_URL      (default http://localhost:8181)
#   INFLUX_TOKEN    (InfluxDB 3 database token)
#   INFLUX_DATABASE my_demo_db
npm install
```

Seed the demo constellation (run again anytime; add a number to change the count):

```bash
npm run seed:satellites        # writes ~1,500 tracks
npm run seed:satellites -- 800 # example custom size
```

**What the seed creates**

| Shell (tag)   | Orbit                    | Use case            | Notes                         |
| ------------- | ------------------------ | ------------------- | ----------------------------- |
| `LEO-Comm`    | 510‑580 km, 50‑56°       | Mega constellations | Mostly green **Active** icons |
| `LEO-ISR`     | 600‑750 km, 85‑99°       | Earth observation   | Mix of active and “watch”     |
| `LEO-Debris`  | 650‑1,100 km, 40‑120°    | Junk field          | High “Offline” count          |
| `MEO-NAV`     | 19,000‑23,000 km, 52‑64° | Navigation birds    | Few but fast                  |
| `GEO-Station` | 35,750‑35,850 km         | GEO belt            | Slow movers                   |

Each satellite document stores the same information we describe on stage:

- `altitude_km`, `perigee_km`, `apogee_km`, `inclination_deg`, `raan_deg`, `phase_deg`, `period_min`
- `status` (Active / Watch / Offline) used for coloring
- `threat_score` + `radar_cross_section` to drive sizing and lists
- `shell`, `object_type`, `country`, `operator`

---

### 2. Start the apps

```bash
npm run dev:server   # http://localhost:4000 APIs
npm run dev:client   # http://localhost:5173 Custom UI & dashboard
```

Keep both commands running in their own terminals.

---

### 3. Talking points

| Area                 | What to say                                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Filters + Legend** | “This mirrors the LeoLabs control panel: pick tags (payload, debris…), select altitude presets or shells, and adjust the animation speed. The legend matches their icons so guests instantly connect the two screens.” |
| **Track view tab**   | “Globe.gl redraws the same orbit story, but every sprite is streamed from InfluxDB 3. We’re not screen-scraping LeoLabs—we re-create the dataset ourselves and keep it live in our database.”                          |
| **SQL tab**          | “Pick a plain-English preset or type a query. The panel auto-refreshes every 5 seconds (thanks to InfluxDB’s query + last-value cache) and we chart the results before pushing them to the globe.”                     |

**Key InfluxDB 3 talking points**

- Store “LeoLabs-scale” telemetry as native time series (tags for shell, status, operator; fields for orbit dynamics).
- Mix historical and real-time queries with low latency using FlightSQL (React dashboard + UI Explorer show the same data).
- Serve the synthetic dataset simultaneously to the globe, UI Explorer, and any FlightSQL client—no duplication.

Sample queries you can paste into the console:

```sql
-- Debris inside the crowded LEO band
SELECT
  time, sat_id, name, object_type, shell,
  altitude_km, inclination_deg, raan_deg, phase_deg, period_min,
  threat_score, radar_cross_section, status
FROM sat_objects
WHERE shell = 'LEO-Debris'
  AND altitude_km BETWEEN 500 AND 1200
ORDER BY threat_score DESC
LIMIT 600;
```

```sql
-- Everything marked “watch” for the next operator shift
SELECT
  time, sat_id, name, shell, status,
  altitude_km, inclination_deg, raan_deg, phase_deg, period_min,
  threat_score
FROM sat_objects
WHERE status ILIKE '%drift%' OR status ILIKE '%risk%'
ORDER BY altitude_km;
```

```sql
-- GEO slots that haven’t checked in lately
SELECT
  time, sat_id, name, operator, shell,
  altitude_km, inclination_deg, raan_deg, phase_deg, period_min,
  last_contact
FROM sat_objects
WHERE shell = 'GEO-Station'
  AND status ILIKE '%offline%'
ORDER BY last_contact;
```

The SQL console requires the columns above (altitude, inclination, RAAN, phase, and period) so the globe can animate the results.

---

### 3b. Optional: show InfluxDB UI Explorer

1. Open the InfluxDB 3 UI Explorer in another browser tab.
2. Connect to the same host/token/database (`my_demo_db`).
3. Paste one of the preset queries (Debris watch, Watchlist, Offline GEO) and run it.
4. Show the rows in UI Explorer, then switch back to the React UI, select the same preset, and press “Use on globe” to paint those rows into the visualization.

---

### 4. API Endpoints (optional)

- `GET /api/satellites?limit=1500&types=payload,debris&minAlt=200&maxAlt=2000`
- `GET /api/satellites/summary`
- `POST /api/query` `{ "sql": "SELECT ..."}`
- Legacy NASA NEO endpoints remain at `/api/neos`, `/api/summary`, `/api/ingest` for extra storytelling.

---

### Deploy/build

```bash
npm run build
# Output: packages/server/dist (API) and packages/client/dist (static UI)
```
