import {useMemo, useState} from 'react'
import {GlobeView} from './components/GlobeView'
import {SatelliteList} from './components/SatelliteList'
import {SatelliteSummary} from './components/SatelliteSummary'
import {SqlConsole} from './components/SqlConsole'
import {useSatelliteData} from './hooks/useSatelliteData'
import type {SatelliteFilters, SatelliteObjectType, SatellitePoint} from './types'
import {STATUS_META} from './utils/status'
import badge from './assets/influxdb-badge.svg'
import './App.css'

const typeOptions: Array<{label: string; value: SatelliteObjectType}> = [
  {label: 'Payloads', value: 'payload'},
  {label: 'Upper stages', value: 'rocket_body'},
  {label: 'Debris', value: 'debris'},
  {label: 'Unknown', value: 'unknown'}
]

const altitudePresets = [
  {id: 'all', label: 'All altitudes (200 – 42,000 km)', range: [200, 42000]},
  {id: 'leo', label: 'LEO (200 – 1,200 km)', range: [200, 1200]},
  {id: 'midleo', label: 'High LEO (1,200 – 2,000 km)', range: [1200, 2000]},
  {id: 'meo', label: 'MEO (2,000 – 25,000 km)', range: [2000, 25000]},
  {id: 'geo', label: 'GEO ring (34,000 – 42,000 km)', range: [34000, 42000]}
]

const shellOptions = [
  {label: 'All shells', value: ''},
  {label: 'LEO-Comm', value: 'LEO-Comm'},
  {label: 'LEO-ISR', value: 'LEO-ISR'},
  {label: 'LEO-Debris', value: 'LEO-Debris'},
  {label: 'MEO-NAV', value: 'MEO-NAV'},
  {label: 'GEO-Station', value: 'GEO-Station'}
]

const sqlDefault = `SELECT time, sat_id, name, object_type, shell, altitude_km, inclination_deg, raan_deg, phase_deg, period_min, threat_score, radar_cross_section
FROM sat_objects
WHERE object_type = 'debris'
ORDER BY threat_score DESC
LIMIT 600`

const defaultFilters: SatelliteFilters = {
  types: ['payload', 'rocket_body', 'debris'],
  altitudeRange: altitudePresets[0].range,
  limit: 2000
}

type MainView = 'globe' | 'sql'

function App() {
  const [filters, setFilters] = useState<SatelliteFilters>(defaultFilters)
  const [mainView, setMainView] = useState<MainView>('sql')
  const [fullScreen, setFullScreen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [speed, setSpeed] = useState(28)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [sqlOverlay, setSqlOverlay] = useState<{satellites: SatellitePoint[]; sql: string} | null>(null)

  const {satellites, summary, loading, error, lastUpdated, refresh} = useSatelliteData(filters, 60000)

  const visibleSatellites = sqlOverlay ? sqlOverlay.satellites : satellites
  const effectiveHighlightedId = highlightedId ?? visibleSatellites[0]?.satId ?? null
  const selectedSatellite = useMemo(
    () =>
      effectiveHighlightedId
        ? visibleSatellites.find((sat) => sat.satId === effectiveHighlightedId) ?? null
        : visibleSatellites[0] ?? null,
    [visibleSatellites, effectiveHighlightedId]
  )

  const toggleType = (type: SatelliteObjectType) => {
    setFilters((prev) => {
      const hasType = prev.types.includes(type)
      const nextTypes = hasType ? prev.types.filter((value) => value !== type) : [...prev.types, type]
      return {...prev, types: nextTypes.length ? nextTypes : [type]}
    })
  }

  const setShell = (value: string) => {
    setFilters((prev) => ({...prev, shell: value || undefined}))
  }

  const handlePresetChange = (presetId: string) => {
    const preset = altitudePresets.find((item) => item.id === presetId)
    if (preset) {
      setFilters((prev) => ({...prev, altitudeRange: preset.range}))
    }
  }

  const activePresetId =
    altitudePresets.find(
      (preset) => preset.range[0] === filters.altitudeRange[0] && preset.range[1] === filters.altitudeRange[1]
    )?.id ?? 'all'

  const statusText = loading
    ? 'Syncing orbital mesh…'
    : lastUpdated
      ? `Updated ${new Date(lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`
      : 'Live'

  const handleApplySql = ({satellites: customSatellites, sql}: {satellites: SatellitePoint[]; sql: string}) => {
    setSqlOverlay({satellites: customSatellites, sql})
    setMainView('globe')
    if (customSatellites.length) {
      setHighlightedId(customSatellites[0].satId)
    }
  }

  const clearSqlOverlay = () => {
    setSqlOverlay(null)
    setHighlightedId(null)
  }

  return (
    <div className={`app-shell${fullScreen ? ' globe-focus' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <div className="badge-line">
            <img src={badge} alt="Built on InfluxDB 3" className="influx-badge" />
            <p className="eyebrow">Ground ops · LeoLabs mocked twin</p>
          </div>
          <h1>Space traffic dashboard</h1>
          <p className="muted small">
            Same story as the LeoLabs LEO visualization—only this view is powered entirely by InfluxDB 3.
          </p>
        </div>
        <div className="header-actions">
          <span className="status-pill">{statusText}</span>
          {sqlOverlay && <span className="pill accent">SQL overlay active</span>}
        </div>
      </header>
      {error && <div className="error-banner">{error}</div>}
      <div className="main-grid">
        <aside className={`side-panel${filtersCollapsed ? ' collapsed' : ''}`}>
          <div className="panel controls">
            <h3>Mission filters</h3>
            <div className="control-group">
              <p className="muted small">Object tags</p>
              <div className="chip-group">
                {typeOptions.map((option) => {
                  const active = filters.types.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`chip${active ? ' active' : ''}`}
                      onClick={() => toggleType(option.value)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="control-group">
              <p className="muted small">Altitude window</p>
              <select value={activePresetId} onChange={(event) => handlePresetChange(event.target.value)}>
                {altitudePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="control-group">
              <p className="muted small">Shell focus</p>
              <select value={filters.shell ?? ''} onChange={(event) => setShell(event.target.value)}>
                {shellOptions.map((shell) => (
                  <option key={shell.value} value={shell.value}>
                    {shell.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="control-group">
              <p className="muted small">Animation speed</p>
              <div className="slider-row">
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                />
                <span>{speed}×</span>
              </div>
            </div>
            {sqlOverlay && (
              <div className="control-group">
                <p className="muted small">Overlay</p>
                <button type="button" onClick={clearSqlOverlay}>
                  Clear SQL overlay
                </button>
                <p className="muted tiny">{sqlOverlay.sql.slice(0, 120)}…</p>
              </div>
            )}
            <div className="legend">
              <p className="muted tiny">Status legend</p>
              {(['active', 'warning', 'inactive'] as const).map((key) => (
                <div className="legend-row" key={key}>
                  <span className={`legend-icon ${key}`} />
                  <div>
                    <strong>{STATUS_META[key].label}</strong>
                    <p className="muted tiny">{STATUS_META[key].description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button type="button" className="collapse-btn" onClick={() => setFiltersCollapsed((prev) => !prev)}>
            {filtersCollapsed ? 'Show filters' : 'Hide filters'}
          </button>
        </aside>
        <section className={`primary-panel${fullScreen ? ' fullscreen' : ''}`}>
          <div className="primary-tabs">
            <div className="tab-buttons">
              <button type="button" className={mainView === 'sql' ? 'active' : ''} onClick={() => setMainView('sql')}>
                SQL analytics
              </button>
              <button type="button" className={mainView === 'globe' ? 'active' : ''} onClick={() => setMainView('globe')}>
                Globe view
              </button>
            </div>
            <div className="primary-tab-actions">
              <button type="button" onClick={refresh} disabled={loading}>
                Refresh tracks
              </button>
              <button type="button" className="accent" onClick={() => setFullScreen((prev) => !prev)}>
                {fullScreen ? 'Exit focus' : 'Focus view'}
              </button>
            </div>
          </div>
          {mainView === 'sql' ? (
            <div className="sql-view">
              <SqlConsole initialQuery={sqlDefault} onApplyToGlobe={handleApplySql} />
              <div className="panel insights-stack">
                <h3>Operational insights</h3>
                <SatelliteSummary
                  summary={summary}
                  activeCount={visibleSatellites.length}
                  lastUpdated={lastUpdated}
                  satellites={visibleSatellites}
                />
                <div className="side-divider" />
                <h3>Watchlist</h3>
                <SatelliteList
                  satellites={visibleSatellites}
                  selectedId={effectiveHighlightedId ?? undefined}
                  onSelect={(sat) => setHighlightedId(sat.satId)}
                />
              </div>
            </div>
          ) : (
            <div className="panel globe-panel">
              <div className="panel-header">
                <div>
                  <h2>Orbital picture</h2>
                  <p className="muted small">
                    {visibleSatellites.length.toLocaleString()} tracks • Alt {filters.altitudeRange[0]} –{' '}
                    {filters.altitudeRange[1]} km
                  </p>
                </div>
                {sqlOverlay && <span className="pill accent">SQL overlay applied</span>}
              </div>
              <div className="globe-wrapper">
                <GlobeView
                  satellites={visibleSatellites}
                  highlightedId={effectiveHighlightedId}
                  speed={speed}
                  onSelect={(sat) => setHighlightedId(sat.satId)}
                  overlayLabel={sqlOverlay ? `SQL overlay (${visibleSatellites.length} rows)` : null}
                />
                {loading && <div className="overlay">Loading tracks…</div>}
              </div>
              {selectedSatellite ? (
                <div className="active-card">
                  <div>
                    <p className="muted small">Sat ID</p>
                    <strong>{selectedSatellite.satId}</strong>
                  </div>
                  <div>
                    <p className="muted small">Shell</p>
                    <strong>{selectedSatellite.shell}</strong>
                  </div>
                  <div>
                    <p className="muted small">Altitude</p>
                    <strong>{selectedSatellite.altitudeKm.toFixed(0)} km</strong>
                  </div>
                  <div>
                    <p className="muted small">Inclination</p>
                    <strong>{selectedSatellite.inclinationDeg.toFixed(1)}°</strong>
                  </div>
                  <div>
                    <p className="muted small">Threat</p>
                    <strong>{selectedSatellite.threatScore.toFixed(2)}</strong>
                  </div>
                  <div>
                    <p className="muted small">Operator</p>
                    <strong>{selectedSatellite.operator}</strong>
                  </div>
                  <div>
                    <p className="muted small">Last contact</p>
                    <strong>
                      {selectedSatellite.lastContact
                        ? new Date(selectedSatellite.lastContact).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '—'}
                    </strong>
                  </div>
                </div>
              ) : (
                <p className="muted small">Select a track to inspect details.</p>
              )}
            </div>
          )}
        </section>
      </div>
      <footer className="footer-badge">
        <img src={badge} alt="Built on InfluxDB 3" />
      </footer>
    </div>
  )
}

export default App
