import type {SatellitePoint} from '../types'
import {STATUS_META, categorizeStatus} from '../utils/status'

interface SatelliteListProps {
  satellites: SatellitePoint[]
  selectedId?: string | null
  onSelect?: (satellite: SatellitePoint) => void
}

const formatNumber = (value: number, digits = 0) => value.toFixed(digits)

export const SatelliteList = ({satellites, selectedId, onSelect}: SatelliteListProps) => {
  const ranked = [...satellites]
    .sort((a, b) => b.threatScore - a.threatScore)
    .slice(0, 24)

  if (!ranked.length) {
    return <p className="muted small">Waiting for synthetic telemetry…</p>
  }

  return (
    <div className="sat-list">
      {ranked.map((sat) => {
        const active = sat.satId === selectedId
        const status = categorizeStatus(sat.status)
        return (
          <button
            type="button"
            key={sat.satId}
            className={`sat-card${active ? ' active' : ''}`}
            onClick={() => onSelect?.(sat)}
          >
            <div className="sat-card-header">
              <div>
                <p className="sat-name">{sat.name}</p>
                <p className="muted small">
                  {sat.country} • {sat.objectType}
                </p>
                <p className="status-chip">
                  <span className={`status-dot ${status}`} />
                  <span>{STATUS_META[status].label}</span>
                </p>
              </div>
              <span className="threat-pill">T{formatNumber(sat.threatScore, 2)}</span>
            </div>
            <div className="sat-card-grid">
              <div>
                <p className="muted small">Altitude</p>
                <strong>{formatNumber(sat.altitudeKm, 0)} km</strong>
              </div>
              <div>
                <p className="muted small">Inclination</p>
                <strong>{formatNumber(sat.inclinationDeg, 0)}°</strong>
              </div>
              <div>
                <p className="muted small">Orbital period</p>
                <strong>{formatNumber(sat.periodMin, 0)} min</strong>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
