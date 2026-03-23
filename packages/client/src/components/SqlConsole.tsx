import {useCallback, useEffect, useMemo, useState} from 'react'
import {Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'
import {runSqlQuery} from '../api'
import type {SatellitePoint, SqlQueryResult} from '../types'

interface SqlConsoleProps {
  initialQuery: string
  onApplyToGlobe: (payload: {satellites: SatellitePoint[]; sql: string}) => void
}

const defaultError =
  'Result needs altitude_km, inclination_deg, raan_deg, period_min, and phase_deg columns to drive the globe.'

interface SqlPreset {
  id: string
  label: string
  sql: string
}

const PRESET_QUERIES: SqlPreset[] = [
  {
    id: 'debris',
    label: 'High-risk debris (500‑1,200 km)',
    sql: `SELECT
  time, sat_id, name, object_type, shell,
  altitude_km, inclination_deg, raan_deg, phase_deg, period_min,
  threat_score, radar_cross_section, status
FROM sat_objects
WHERE shell = 'LEO-Debris'
  AND altitude_km BETWEEN 500 AND 1200
ORDER BY threat_score DESC
LIMIT 600`
  },
  {
    id: 'watch',
    label: 'Watchlist (drift or maneuver)',
    sql: `SELECT
  time, sat_id, name, shell, status,
  altitude_km, inclination_deg, raan_deg, phase_deg, period_min,
  threat_score
FROM sat_objects
WHERE status ILIKE '%drift%' OR status ILIKE '%risk%'
ORDER BY altitude_km`
  },
  {
    id: 'geo',
    label: 'Offline GEO birds',
    sql: `SELECT
  time, sat_id, name, operator, shell,
  altitude_km, inclination_deg, raan_deg, phase_deg, period_min,
  last_contact
FROM sat_objects
WHERE shell = 'GEO-Station'
  AND status ILIKE '%offline%'
ORDER BY last_contact`
  }
]

const pickColumn = (columns: string[], names: string[]) =>
  columns.find((column) => names.includes(column.toLowerCase()))

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

const mapRowsToSatellites = (result: SqlQueryResult): SatellitePoint[] => {
  if (!result.rows.length) {
    return []
  }
  const columns = result.columns
  const altitudeCol = pickColumn(columns, ['altitude_km', 'alt_km', 'altitude'])
  const inclCol = pickColumn(columns, ['inclination_deg', 'inclination', 'incl'])
  const raanCol = pickColumn(columns, ['raan_deg', 'raan'])
  const phaseCol = pickColumn(columns, ['phase_deg', 'phase'])
  const periodCol = pickColumn(columns, ['period_min', 'period'])
  if (!altitudeCol || !inclCol || !raanCol || !phaseCol || !periodCol) {
    return []
  }
  const satIdCol = pickColumn(columns, ['sat_id', 'id', 'object_id'])
  const nameCol = pickColumn(columns, ['name', 'sat_name'])
  const typeCol = pickColumn(columns, ['object_type', 'type'])
  const shellCol = pickColumn(columns, ['shell'])
  const threatCol = pickColumn(columns, ['threat_score', 'threat'])
  const rcsCol = pickColumn(columns, ['radar_cross_section', 'rcs'])

  return result.rows.map((row, index) => ({
    satId: String(row[satIdCol ?? 'sat_id'] ?? `sql_${index}`),
    name: String(row[nameCol ?? 'name'] ?? `SQL object ${index + 1}`),
    objectType: String(row[typeCol ?? 'object_type'] ?? 'unknown'),
    shell: String(row[shellCol ?? 'shell'] ?? 'SQL overlay'),
    country: String(row.country ?? 'N/A'),
    operator: String(row.operator ?? 'Query'),
    status: String(row.status ?? 'Derived'),
    altitudeKm: toNumber(row[altitudeCol], 550),
    perigeeKm: toNumber(row.perigee_km ?? row.perigee ?? row[altitudeCol], 500),
    apogeeKm: toNumber(row.apogee_km ?? row.apogee ?? row[altitudeCol], 550),
    inclinationDeg: toNumber(row[inclCol], 0),
    raanDeg: toNumber(row[raanCol], 0),
    phaseDeg: toNumber(row[phaseCol], 0),
    periodMin: toNumber(row[periodCol], 95),
    velocityKps: toNumber(row.velocity_kps ?? 0, 7.5),
    threatScore: toNumber(threatCol ? row[threatCol] : 0, 0),
    radarCrossSection: toNumber(rcsCol ? row[rcsCol] : 0.2, 0.2),
    colorHex: typeof row.color_hex === 'string' ? row.color_hex : '#22d3ee',
    timestamp: new Date().toISOString(),
    lastContact: new Date().toISOString()
  }))
}

export const SqlConsole = ({initialQuery, onApplyToGlobe}: SqlConsoleProps) => {
  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SqlQueryResult | null>(null)
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const [lastDuration, setLastDuration] = useState<number | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string>('debris')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const runQuery = useCallback(
    async (text?: string) => {
      const sql = (typeof text === 'string' ? text : query).trim()
      if (!sql) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const start = performance.now()
        const payload = await runSqlQuery(sql)
        setResult(payload)
        setLastRunAt(new Date().toISOString())
        setLastDuration(performance.now() - start)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Query failed')
      } finally {
        setLoading(false)
      }
    },
    [query]
  )

  useEffect(() => {
    if (!autoRefresh) {
      return
    }
    const interval = setInterval(() => {
      if (!loading) {
        runQuery().catch(() => undefined)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, loading, runQuery])

  const applyResult = () => {
    if (!result) {
      setError('Run a query first')
      return
    }
    const satellites = mapRowsToSatellites(result)
    if (!satellites.length) {
      setError(defaultError)
      return
    }
    onApplyToGlobe({satellites, sql: query})
  }

const metricsSeries = useMemo(() => {
  if (!result?.rows.length) {
    return null
  }
  const base = Date.now()
  const bucketMs = 5000
  const buckets = new Map<number, {count: number; altitude: number; threat: number}>()
  result.rows.forEach((row, index) => {
    const rawTime =
      row.time ??
      row.TIME ??
      row.timestamp ??
      row.TIMESTAMP ??
      row._time ??
      row['_time'] ??
      null
    const parsed =
      typeof rawTime === 'number'
        ? rawTime
        : typeof rawTime === 'string'
          ? Date.parse(rawTime)
          : Number.NaN
    const timestamp = Number.isFinite(parsed) ? parsed : base + index * 1000
    const bucket = base + Math.floor((timestamp - base) / bucketMs) * bucketMs
    const entry = buckets.get(bucket) ?? {count: 0, altitude: 0, threat: 0}
    entry.count += 1
    entry.altitude += toNumber(row.altitude_km, 0)
    entry.threat += toNumber(row.threat_score, 0)
    buckets.set(bucket, entry)
  })
  const series = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, entry]) => ({
      timestamp,
      altitude: entry.count ? entry.altitude / entry.count : 0,
      threat: entry.count ? entry.threat / entry.count : 0
    }))
  return series.length ? series : null
}, [result])

  const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const colorizeSql = (input: string) => {
    const escaped = escapeHtml(input)
    return escaped
      .replace(
        /\b(select|from|where|and|or|limit|order|by|group|asc|desc|inner|left|right|join|on)\b/gi,
        '<span class="sql-keyword">$1</span>'
      )
      .replace(/('[^']*')/g, '<span class="sql-string">$1</span>')
  }

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value)
    const preset = PRESET_QUERIES.find((item) => item.id === value)
    if (preset) {
      setQuery(preset.sql)
    }
  }

  return (
    <div className="panel sql-panel">
      <div className="sql-header">
        <div>
          <h3>Influx SQL console</h3>
          <p className="muted small">Pick a preset or write your own query. Auto-refresh shows real-time updates.</p>
        </div>
        <div className="sql-actions">
          <button type="button" onClick={runQuery} disabled={loading}>
            {loading ? 'Running…' : 'Run query'}
          </button>
          <button type="button" className="accent" onClick={applyResult} disabled={!result || loading}>
            Use on globe
          </button>
        </div>
      </div>
      <div className="sql-toolbar">
        <select value={selectedPreset} onChange={(event) => handlePresetChange(event.target.value)}>
          {PRESET_QUERIES.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
      const preset = PRESET_QUERIES.find((item) => item.id === selectedPreset)
            if (!preset) {
              return
            }
            setQuery(preset.sql)
            runQuery(preset.sql).catch(() => undefined)
          }}
          disabled={loading}
        >
          Run preset query
        </button>
        <label className="auto-refresh">
          <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
          Auto refresh (5s)
        </label>
      </div>
      <p className="muted tiny preset-hint">Run preset loads the saved SQL above; Run query executes whatever is in the editor.</p>
      <div className="sql-editor">
        <pre className="sql-highlight" aria-hidden dangerouslySetInnerHTML={{__html: colorizeSql(query) + '\n'}} />
      <textarea
        className="sql-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        spellCheck={false}
      />
      </div>
      {error && <p className="sql-error">{error}</p>}
      <div className="sql-metrics">
        <div>
          <p className="muted tiny">Rows</p>
          <strong>{result?.rows.length ?? 0}</strong>
        </div>
        <div>
          <p className="muted tiny">Columns</p>
          <strong>{result?.columns.length ?? 0}</strong>
        </div>
        <div>
          <p className="muted tiny">Last run</p>
          <strong>
            {lastRunAt ? new Date(lastRunAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '—'}
          </strong>
        </div>
        <div>
          <p className="muted tiny">Query latency</p>
          <strong>{lastDuration ? `${Math.round(lastDuration)} ms` : '—'}</strong>
        </div>
      </div>
      {result && (
        <div className="sql-visuals">
          {metricsSeries && (
            <>
              <div className="sql-chart">
                <p className="muted tiny">Altitude over time</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={metricsSeries}>
                    <CartesianGrid stroke="#1f2f45" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      stroke="#94a3b8"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleTimeString([], {minute: '2-digit', second: '2-digit'})
                      }
                      label={{value: 'Time', position: 'insideBottom', offset: -6, fill: '#94a3b8'}}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      label={{value: 'Altitude (km)', angle: -90, position: 'insideLeft', fill: '#94a3b8'}}
                    />
                    <Tooltip
                      labelFormatter={(value) =>
                        new Date(value).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})
                      }
                    />
                    <Line type="monotone" dataKey="altitude" stroke="#3b82f6" strokeWidth={3} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="sql-chart">
                <p className="muted tiny">Threat score timeline</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={metricsSeries}>
                    <CartesianGrid stroke="#1f2f45" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      stroke="#94a3b8"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleTimeString([], {minute: '2-digit', second: '2-digit'})
                      }
                      label={{value: 'Time', position: 'insideBottom', offset: -6, fill: '#94a3b8'}}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      label={{value: 'Threat score', angle: -90, position: 'insideLeft', fill: '#94a3b8'}}
                    />
                    <Tooltip
                      labelFormatter={(value) =>
                        new Date(value).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})
                      }
                    />
                    <Line type="monotone" dataKey="threat" stroke="#f97316" strokeWidth={3} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          <div className="sql-result">
            <div className="sql-table-wrapper">
              <table>
                <thead>
                  <tr>
                    {result.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 12).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {result.columns.map((column) => (
                        <td key={column}>{String(row[column] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > 12 && <p className="muted small">Showing first 12 rows</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
