import type {NeoPoint} from '../types'

interface NeoListProps {
  points: NeoPoint[]
  selectedId?: string
  onSelect: (point: NeoPoint) => void
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return `${date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} · ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })}`
}

export const NeoList = ({points, onSelect, selectedId}: NeoListProps) => {
  if (!points.length) {
    return (
      <div className="panel">
        <h2>Upcoming approaches</h2>
        <p className="muted">Waiting for telemetry...</p>
      </div>
    )
  }

  return (
    <div className="panel list-panel">
      <h2>Upcoming approaches</h2>
      <div className="neo-list">
        {points.map((point) => {
          const active = point.approachId === selectedId
          return (
            <button
              type="button"
              className={`neo-card${active ? ' active' : ''}`}
              key={point.approachId}
              onClick={() => onSelect(point)}
            >
              <div className="neo-card-header">
                <div>
                  <p className="neo-name">{point.name}</p>
                  <p className="muted">{formatDateTime(point.approachTime)}</p>
                </div>
                <span className={`hazard-dot ${point.hazardous ? 'hazard' : 'safe'}`}>
                  {point.hazardous ? 'HAZ' : 'OK'}
                </span>
              </div>
              <div className="neo-card-grid">
                <div>
                  <p className="muted">Velocity</p>
                  <strong>{point.velocityKps.toFixed(2)} km/s</strong>
                </div>
                <div>
                  <p className="muted">Miss distance</p>
                  <strong>{point.missDistanceKm.toFixed(0)} km</strong>
                </div>
                <div>
                  <p className="muted">Risk score</p>
                  <strong>{point.riskScore.toFixed(1)}</strong>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
