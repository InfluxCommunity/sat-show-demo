import {collectRows, rowTimeToIso} from './queryUtils'
import type {SatelliteDTO, SatelliteFilters, SatelliteSummaryDTO} from './types'

const MEASUREMENT = 'sat_objects'

const sanitize = (value: string) => value.replace(/'/g, "''")

const buildFilterClause = (filters: SatelliteFilters = {}) => {
  const conditions: string[] = []
  if (filters.types && filters.types.length) {
    const typeList = filters.types.map((type) => `'${sanitize(type)}'`).join(', ')
    conditions.push(`object_type IN (${typeList})`)
  }
  if (typeof filters.minAlt === 'number') {
    conditions.push(`altitude_km >= ${filters.minAlt}`)
  }
  if (typeof filters.maxAlt === 'number') {
    conditions.push(`altitude_km <= ${filters.maxAlt}`)
  }
  if (filters.shell) {
    conditions.push(`shell = '${sanitize(filters.shell)}'`)
  }
  if (!conditions.length) {
    return ''
  }
  return `WHERE ${conditions.join(' AND ')}`
}

const mapSatelliteRow = (row: Record<string, any>): SatelliteDTO => ({
  satId: row.sat_id ?? row.neo_id ?? `sat_${row.time}`,
  name: row.name ?? 'Unknown asset',
  objectType: row.object_type ?? 'unknown',
  shell: row.shell ?? 'LEO',
  country: row.country ?? 'Unknown',
  operator: row.operator ?? 'Unknown',
  status: row.status ?? 'Unknown',
  altitudeKm: Number(row.altitude_km ?? 0),
  perigeeKm: Number(row.perigee_km ?? row.altitude_km ?? 0),
  apogeeKm: Number(row.apogee_km ?? row.altitude_km ?? 0),
  inclinationDeg: Number(row.inclination_deg ?? 0),
  raanDeg: Number(row.raan_deg ?? 0),
  phaseDeg: Number(row.phase_deg ?? 0),
  periodMin: Number(row.period_min ?? 90),
  velocityKps: Number(row.velocity_kps ?? 7.5),
  threatScore: Number(row.threat_score ?? 0),
  radarCrossSection: Number(row.radar_cross_section ?? 0),
  colorHex: row.color_hex ?? '#38bdf8',
  timestamp: rowTimeToIso(row.time),
  lastContact: rowTimeToIso(row.last_contact ?? row.time)
})

export const fetchSatellites = async (limit = 1200, filters: SatelliteFilters = {}) => {
  const where = buildFilterClause(filters)
  const query = `
    SELECT time,
      sat_id,
      name,
      object_type,
      shell,
      country,
      operator,
      status,
      altitude_km,
      perigee_km,
      apogee_km,
      inclination_deg,
      raan_deg,
      phase_deg,
      period_min,
      velocity_kps,
      threat_score,
      radar_cross_section,
      color_hex,
      last_contact
    FROM ${MEASUREMENT}
    ${where}
    ORDER BY time DESC
    LIMIT ${Math.max(10, Math.min(limit, 4000))}
  `
  const rows = await collectRows(query)
  return rows.map(mapSatelliteRow)
}

const mapCountRows = (rows: Record<string, any>[], field: string) =>
  rows.map((row) => ({
    key: row[field] ?? 'unknown',
    count: Number(row.count ?? row.total ?? 0)
  }))

export const fetchSatelliteSummary = async (): Promise<SatelliteSummaryDTO> => {
  const totalsQuery = `
    SELECT COUNT(*) AS total
    FROM ${MEASUREMENT}
  `
  const typeQuery = `
    SELECT object_type, COUNT(*) AS count
    FROM ${MEASUREMENT}
    GROUP BY object_type
  `
  const statusQuery = `
    SELECT status, COUNT(*) AS count
    FROM ${MEASUREMENT}
    GROUP BY status
  `
  const countryQuery = `
    SELECT country, COUNT(*) AS count
    FROM ${MEASUREMENT}
    GROUP BY country
    ORDER BY count DESC
    LIMIT 8
  `
  const shellQuery = `
    SELECT shell, COUNT(*) AS count
    FROM ${MEASUREMENT}
    GROUP BY shell
  `

  const [totals, byType, byStatus, byCountry, byShell] = await Promise.all([
    collectRows(totalsQuery),
    collectRows(typeQuery),
    collectRows(statusQuery),
    collectRows(countryQuery),
    collectRows(shellQuery)
  ])

  const total = Number((totals[0] ?? {}).total ?? 0)
  return {
    total,
    types: mapCountRows(byType, 'object_type'),
    statuses: mapCountRows(byStatus, 'status'),
    countries: mapCountRows(byCountry, 'country'),
    shells: mapCountRows(byShell, 'shell')
  }
}
