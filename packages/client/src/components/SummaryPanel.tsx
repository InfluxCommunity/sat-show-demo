import {Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'
import type {NeoSummary} from '../types'

interface SummaryPanelProps {
  summary: NeoSummary | null
}

const chartColors = ['#38bdf8', '#fb7185', '#a78bfa', '#fbbf24', '#34d399']

const formatDayLabel = (value: string) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
}

export const SummaryPanel = ({summary}: SummaryPanelProps) => {
  if (!summary) {
    return (
      <div className="panel">
        <h2>Telemetry</h2>
        <p className="muted">Fetching summary...</p>
      </div>
    )
  }

  const hazardRatio = summary.total ? (summary.hazardous / summary.total) * 100 : 0
  const orbitData = summary.byOrbit.slice(0, 6)

  return (
    <div className="panel">
      <h2>Near-Earth Object Telemetry</h2>
      <div className="stats-grid">
        <div>
          <p>Total tracked</p>
          <strong>{summary.total}</strong>
        </div>
        <div>
          <p>Potentially hazardous</p>
          <strong>{summary.hazardous}</strong>
          <span className="muted">{hazardRatio.toFixed(1)}%</span>
        </div>
        <div>
          <p>New this week</p>
          <strong>{summary.recent}</strong>
        </div>
        <div>
          <p>Last ingest</p>
          <strong>{summary.lastIngest ? new Date(summary.lastIngest).toLocaleTimeString() : '—'}</strong>
        </div>
      </div>
      <div className="charts">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Approaches per day</h3>
            <span className="muted">Rolling 3 weeks</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={summary.countsByDay} margin={{top: 16, right: 16, left: 0, bottom: 0}}>
              <defs>
                <linearGradient id="countGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tickFormatter={(value: string | number) => formatDayLabel(String(value))}
                stroke="#5eead4"
                fontSize={12}
              />
              <YAxis allowDecimals={false} stroke="#5eead4" fontSize={12} width={32} />
              <Tooltip labelFormatter={(value: string | number) => formatDayLabel(String(value))} />
              <Area type="monotone" dataKey="count" stroke="#38bdf8" fill="url(#countGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <h3>Orbit focus</h3>
            <span className="muted">Top bodies</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={orbitData}
                  dataKey="count"
                  nameKey="orbitingBody"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {orbitData.map((entry, index) => (
                    <Cell key={entry.orbitingBody} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
              <Tooltip
                formatter={(value: number, _name: string, {payload}: {payload: {orbitingBody: string}}) => [
                  `${value} flybys`,
                  payload.orbitingBody
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
