import {useMemo, useState} from 'react'
import {GlobeScene} from './components/GlobeScene'
import {NeoList} from './components/NeoList'
import {SummaryPanel} from './components/SummaryPanel'
import {useNeoDashboard} from './hooks/useNeoDashboard'
import type {NeoPoint, TimeWindow} from './types'
import './App.css'

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_LENGTH_DAYS = 14

const createWindowRange = (center: Date): TimeWindow => {
  const span = Math.floor(WINDOW_LENGTH_DAYS / 2)
  const from = new Date(center.getTime() - span * DAY_MS)
  const to = new Date(center.getTime() + span * DAY_MS)
  return {from: from.toISOString(), to: to.toISOString()}
}

const formatWindowLabel = (windowRange: TimeWindow) => {
  if (!windowRange.from || !windowRange.to) {
    return 'Recent activity'
  }
  const formatter: Intl.DateTimeFormatOptions = {month: 'short', day: 'numeric', year: 'numeric'}
  const start = new Date(windowRange.from)
  const end = new Date(windowRange.to)
  return `${start.toLocaleDateString(undefined, formatter)} – ${end.toLocaleDateString(undefined, formatter)}`
}

function App() {
  const [windowCenter, setWindowCenter] = useState<Date>(() => new Date())
  const windowRange = useMemo(() => createWindowRange(windowCenter), [windowCenter])
  const windowLabel = useMemo(() => formatWindowLabel(windowRange), [windowRange])
  const {points, summary, loading, refreshing, error, lastUpdated, ingesting, refresh, ingest} =
    useNeoDashboard(windowRange)
  const [selectedApproachId, setSelectedApproachId] = useState<string | null>(null)

  const activeNeo = useMemo(() => {
    if (!points.length) {
      return null
    }
    if (selectedApproachId) {
      const match = points.find((point) => point.approachId === selectedApproachId)
      if (match) {
        return match
      }
    }
    return points[0]
  }, [points, selectedApproachId])

  const handleSelect = (neo: NeoPoint) => {
    setSelectedApproachId(neo.approachId)
  }

  const statusText = useMemo(() => {
    if (loading) {
      return 'Syncing NASA feed'
    }
    if (refreshing) {
      return 'Refreshing telemetry'
    }
    return lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 'Idle'
  }, [loading, refreshing, lastUpdated])

  const shiftWindow = (days: number) => {
    setWindowCenter((prev) => new Date(prev.getTime() + days * DAY_MS))
  }

  const jumpToToday = () => setWindowCenter(new Date())
  const isCurrentWindow = Math.abs(windowCenter.getTime() - Date.now()) < DAY_MS

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Near-Earth Objects</p>
          <h1>Orbital Operations Console</h1>
        </div>
        <div className="header-actions">
          <span className="status-pill">{statusText}</span>
          <button type="button" onClick={refresh} disabled={loading || refreshing}>
            Refresh data
          </button>
          <button type="button" className="accent" onClick={ingest} disabled={ingesting}>
            {ingesting ? 'Capturing…' : 'Capture now'}
          </button>
        </div>
      </header>
      <div className="window-controls panel">
        <div className="window-buttons">
          <button type="button" onClick={() => shiftWindow(-WINDOW_LENGTH_DAYS)}>
            ← Earlier
          </button>
          <button type="button" onClick={() => shiftWindow(WINDOW_LENGTH_DAYS)}>
            Later →
          </button>
          <button type="button" onClick={jumpToToday} disabled={isCurrentWindow}>
            Jump to today
          </button>
        </div>
        <div className="window-label">
          <p className="muted">Date window</p>
          <strong>{windowLabel}</strong>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <main className="dashboard-grid">
        <section className="panel globe-panel">
          <div className="panel-header">
            <h2>Orbital theater</h2>
            <span className="muted">{points.length} tracked passes</span>
          </div>
          <div className="globe-wrapper">
            <GlobeScene points={points} onSelect={handleSelect} highlightedId={activeNeo?.approachId} />
            {loading && <div className="overlay">Syncing NEOs…</div>}
          </div>
          {activeNeo ? (
            <div className="active-readout">
              <div>
                <p className="muted">Designation</p>
                <strong>{activeNeo.name}</strong>
              </div>
              <div>
                <p className="muted">Approach</p>
                <strong>
                  {new Date(activeNeo.approachTime).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </strong>
              </div>
              <div>
                <p className="muted">Velocity</p>
                <strong>{activeNeo.velocityKps.toFixed(2)} km/s</strong>
              </div>
              <div>
                <p className="muted">Miss distance</p>
                <strong>{activeNeo.missDistanceKm.toFixed(0)} km</strong>
              </div>
              <div>
                <p className="muted">Risk</p>
                <strong>{activeNeo.riskScore.toFixed(1)}</strong>
              </div>
              <div>
                <p className="muted">Orbit</p>
                <strong>{activeNeo.orbitingBody}</strong>
              </div>
              <div className="spacer" />
              {activeNeo.referenceUrl && (
                <a href={activeNeo.referenceUrl} target="_blank" rel="noreferrer" className="link">
                  NASA JPL entry ↗
                </a>
              )}
            </div>
          ) : (
            <p className="muted">Select an object to inspect track details.</p>
          )}
        </section>
        <SummaryPanel summary={summary} />
        <NeoList points={points} selectedId={activeNeo?.approachId} onSelect={handleSelect} />
      </main>
    </div>
  )
}

export default App
