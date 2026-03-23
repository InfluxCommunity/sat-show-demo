import type {SatellitePoint, SatelliteSummary} from '../types'
import {STATUS_META, categorizeStatus} from '../utils/status'

interface SatelliteSummaryProps {
  summary: SatelliteSummary | null
  activeCount: number
  lastUpdated?: string | null
  satellites: SatellitePoint[]
}

const typeColors: Record<string, string> = {
  payload: '#16a34a',
  rocket_body: '#fb923c',
  debris: '#f472b6',
  unknown: '#94a3b8'
}

const renderBar = (label: string, value: number, total: number, color: string) => {
  const percent = total ? (value / total) * 100 : 0
  return (
    <div className="bar-row" key={label}>
      <div className="bar-label">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{width: `${percent}%`, background: color}} />
      </div>
    </div>
  )
}

const computeStatusMetrics = (satellites: SatellitePoint[]) => {
  return satellites.reduce(
    (acc, sat) => {
      const bucket = categorizeStatus(sat.status)
      acc[bucket] += 1
      acc.altitude += sat.altitudeKm
      acc.velocity += sat.velocityKps
      return acc
    },
    {active: 0, warning: 0, inactive: 0, altitude: 0, velocity: 0}
  )
}

export const SatelliteSummary = ({summary, activeCount, lastUpdated, satellites}: SatelliteSummaryProps) => {
  if (!summary) {
    return <p className="muted small">Loading synthetic telemetry…</p>
  }

  const topTypes = summary.types.slice(0, 4)
  const topCountries = summary.countries.slice(0, 5)
  const shellCount = summary.shells.slice(0, 4)
  const statusMetrics = computeStatusMetrics(satellites)
  const avgAltitude = satellites.length ? statusMetrics.altitude / satellites.length : 0
  const avgVelocity = satellites.length ? statusMetrics.velocity / satellites.length : 0

  return (
    <div className="summary-root">
      <div className="summary-grid">
        <div>
          <p className="muted small">Objects tracked</p>
          <strong className="stat-large">{summary.total.toLocaleString()}</strong>
        </div>
        <div>
          <p className="muted small">In current filter</p>
          <strong className="stat-large">{activeCount.toLocaleString()}</strong>
        </div>
        <div>
          <p className="muted small">Last ingest</p>
          <strong className="stat-large">
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '—'}
          </strong>
        </div>
      </div>
      <div className="summary-grid secondary">
        {(['active', 'warning', 'inactive'] as const).map((key) => (
          <div key={key} className="status-card">
            <p className="muted tiny">{STATUS_META[key].label}</p>
            <strong>{statusMetrics[key]}</strong>
            <span className="muted tiny">{STATUS_META[key].description}</span>
          </div>
        ))}
        <div>
          <p className="muted tiny">Mean altitude</p>
          <strong>{avgAltitude.toFixed(0)} km</strong>
        </div>
        <div>
          <p className="muted tiny">Mean velocity</p>
          <strong>{avgVelocity.toFixed(1)} km/s</strong>
        </div>
      </div>
      <div className="summary-section">
        <h4>Object types</h4>
        {topTypes.map((bucket) =>
          renderBar(bucket.key, bucket.count, summary.total, typeColors[bucket.key] ?? '#38bdf8')
        )}
      </div>
      <div className="summary-section dual">
        <div>
          <h4>Top countries</h4>
          <ul className="summary-list">
            {topCountries.map((country) => (
              <li key={country.key}>
                <span>{country.key}</span>
                <span>{country.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Shell occupancy</h4>
          <ul className="summary-list">
            {shellCount.map((shell) => (
              <li key={shell.key}>
                <span>{shell.key}</span>
                <span>{shell.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
