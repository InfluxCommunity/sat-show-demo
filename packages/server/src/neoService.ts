import axios from 'axios'
import {Point} from '@influxdata/influxdb3-client'
import {appConfig} from './config'
import {influxClient} from './influxClient'
import {collectRows, rowTimeToIso} from './queryUtils'
import {
  CloseApproach,
  NeoBrowseResponse,
  NeoFeedResponse,
  NeoPointDTO,
  NeoSummaryDTO,
  NearEarthObject,
  TimeWindow
} from './types'

const NASA_BROWSE_ENDPOINT = 'https://api.nasa.gov/neo/rest/v1/neo/browse'
const NASA_FEED_ENDPOINT = 'https://api.nasa.gov/neo/rest/v1/feed'
const MAX_PAGE_SIZE = 50
const FEED_LOOKBACK_DAYS = 1
const FEED_LOOKAHEAD_DAYS = 6
const DAY_MS = 24 * 60 * 60 * 1000
const LOOKBACK_WINDOW_MS = 14 * DAY_MS // two weeks
const LOOKAHEAD_WINDOW_MS = 90 * DAY_MS // 90 days
const DEFAULT_WINDOW_SQL = "time >= now() - interval '21 day'"

let lastIngestTimestamp: number | null = null
let ingestInFlight: Promise<IngestStats> | null = null

const toIsoString = (value: Date) => value.toISOString()

interface IngestStats {
  written: number
}

const normalizeWindow = (window?: TimeWindow): TimeWindow | undefined => {
  if (!window) {
    return undefined
  }
  const fromTime = window.from ? Date.parse(window.from) : undefined
  const toTime = window.to ? Date.parse(window.to) : undefined
  if (!fromTime && !toTime) {
    return undefined
  }
  if (typeof fromTime === 'number' && typeof toTime === 'number' && fromTime > toTime) {
    return {from: window.to, to: window.from}
  }
  return {
    from: window.from,
    to: window.to
  }
}

const buildWhereClause = (window?: TimeWindow) => {
  const normalized = normalizeWindow(window)
  const conditions: string[] = []
  if (normalized?.from) {
    conditions.push(`time >= '${normalized.from}'`)
  }
  if (normalized?.to) {
    conditions.push(`time <= '${normalized.to}'`)
  }
  if (!conditions.length) {
    return `WHERE ${DEFAULT_WINDOW_SQL}`
  }
  return `WHERE ${conditions.join(' AND ')}`
}

const buildRecentWindow = (window?: TimeWindow): TimeWindow => {
  const normalized = normalizeWindow(window)
  const recentEnd = normalized?.to ? new Date(normalized.to) : new Date()
  const recentStart = new Date(recentEnd.getTime() - 7 * DAY_MS)
  return {
    from: toIsoString(recentStart),
    to: toIsoString(recentEnd)
  }
}

const parseNumber = (value?: string | number | null): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (!value) {
    return 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const deriveEpochMs = (approach: CloseApproach): number | null => {
  if (typeof approach.epoch_date_close_approach === 'number') {
    return approach.epoch_date_close_approach
  }
  const dateString = approach.close_approach_date_full?.replace(' ', 'T') ?? `${approach.close_approach_date}T00:00:00Z`
  const parsed = Date.parse(dateString)
  return Number.isFinite(parsed) ? parsed : null
}

const computeRiskScore = (diameterKm: number, velocityKps: number, missDistanceKm: number, hazardous: boolean) => {
  if (!diameterKm || !velocityKps) {
    return 0
  }
  const hazardBoost = hazardous ? 1.5 : 1
  const distanceNormalizer = Math.max(missDistanceKm, 1) / 10000
  return Number(((diameterKm * velocityKps * hazardBoost) / distanceNormalizer).toFixed(3))
}

const buildPointsFromResponse = (neos: NearEarthObject[]): Point[] => {
  const now = Date.now()
  const points: Point[] = []

  neos.forEach((neo) => {
    const diameterBounds = neo.estimated_diameter?.kilometers
    const avgDiameter = diameterBounds
      ? (diameterBounds.estimated_diameter_min + diameterBounds.estimated_diameter_max) / 2
      : 0

    neo.close_approach_data?.forEach((approach) => {
      const approachEpoch = deriveEpochMs(approach)
      if (!approachEpoch) {
        return
      }
      if (approachEpoch < now - LOOKBACK_WINDOW_MS || approachEpoch > now + LOOKAHEAD_WINDOW_MS) {
        return
      }

      const velocityKps = parseNumber(approach.relative_velocity?.kilometers_per_second)
      const missDistanceKm = parseNumber(approach.miss_distance?.kilometers)
      const riskScore = computeRiskScore(
        avgDiameter,
        velocityKps,
        missDistanceKm,
        neo.is_potentially_hazardous_asteroid ?? false
      )
      const point = Point.measurement('neo_flyby')
        .setTag('neo_id', neo.neo_reference_id ?? neo.id)
        .setTag('approach_id', `${neo.neo_reference_id}_${approachEpoch}`)
        .setTag('orbiting_body', approach.orbiting_body ?? 'unknown')
        .setStringField('name', neo.name)
        .setBooleanField('hazardous', Boolean(neo.is_potentially_hazardous_asteroid))
        .setFloatField('magnitude', neo.absolute_magnitude_h ?? 0)
        .setFloatField('diameter_km', Number(avgDiameter.toFixed(4)))
        .setFloatField('velocity_kps', Number(velocityKps.toFixed(4)))
        .setFloatField('miss_distance_km', Number(missDistanceKm.toFixed(2)))
        .setFloatField('risk_score', riskScore)
        .setStringField('reference_url', neo.nasa_jpl_url)
        .setTimestamp(new Date(approachEpoch))

      points.push(point)
    })
  })

  return points
}

const fetchBrowsePage = async (): Promise<NearEarthObject[]> => {
  const {data} = await axios.get<NeoBrowseResponse>(NASA_BROWSE_ENDPOINT, {
    params: {
      api_key: appConfig.nasa.apiKey,
      size: MAX_PAGE_SIZE
    }
  })
  return data.near_earth_objects ?? []
}

const fetchFeedWindow = async (): Promise<NearEarthObject[]> => {
  const now = new Date()
  const start = new Date(now.getTime() - FEED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const end = new Date(now.getTime() + FEED_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000)
  const format = (value: Date) => value.toISOString().slice(0, 10)
  const {data} = await axios.get<NeoFeedResponse>(NASA_FEED_ENDPOINT, {
    params: {
      api_key: appConfig.nasa.apiKey,
      start_date: format(start),
      end_date: format(end)
    }
  })
  const buckets = data.near_earth_objects ?? {}
  return Object.values(buckets).flat()
}

const runIngest = async (): Promise<IngestStats> => {
  const [feed, browse] = await Promise.all([fetchFeedWindow(), fetchBrowsePage()])
  const merged = [...feed, ...browse]

  const points = buildPointsFromResponse(merged)
  if (!points.length) {
    return {written: 0}
  }

  await influxClient.write(points, appConfig.influx.database)
  lastIngestTimestamp = Date.now()
  return {written: points.length}
}

export const triggerIngest = async () => {
  if (ingestInFlight) {
    return ingestInFlight
  }
  ingestInFlight = runIngest()
  try {
    return await ingestInFlight
  } finally {
    ingestInFlight = null
  }
}

export const scheduleIngest = (intervalMs: number, logger: Console) => {
  const execute = async () => {
    try {
      const {written} = await triggerIngest()
      logger.info(`[ingest] captured ${written} close approaches`)
    } catch (error) {
      logger.error('[ingest] failed', error)
    }
  }
  execute()
  return setInterval(execute, intervalMs)
}

export const fetchNeoPoints = async (limit = 40, window?: TimeWindow): Promise<NeoPointDTO[]> => {
  const whereClause = buildWhereClause(window)
  const query = `
    SELECT
      time,
      approach_id,
      neo_id,
      orbiting_body,
      name,
      hazardous,
      magnitude,
      diameter_km,
      velocity_kps,
      miss_distance_km,
      risk_score,
      reference_url
    FROM neo_flyby
    ${whereClause}
    ORDER BY time ASC
    LIMIT ${Math.max(1, Math.min(limit, 200))}
  `

  const rows = await collectRows(query)
  return rows.map((row) => ({
    approachId: row.approach_id ?? `${row.neo_id}_${row.time}`,
    neoId: row.neo_id,
    name: row.name,
    orbitingBody: row.orbiting_body,
    hazardous: Boolean(row.hazardous),
    magnitude: Number(row.magnitude ?? 0),
    diameterKm: Number(row.diameter_km ?? 0),
    velocityKps: Number(row.velocity_kps ?? 0),
    missDistanceKm: Number(row.miss_distance_km ?? 0),
    riskScore: Number(row.risk_score ?? 0),
    approachTime: rowTimeToIso(row.time),
    referenceUrl: row.reference_url ?? ''
  }))
}

export const fetchNeoSummary = async (window?: TimeWindow): Promise<NeoSummaryDTO> => {
  const baseWhere = buildWhereClause(window)
  const recentWindow = buildRecentWindow(window)
  const recentWhere = buildWhereClause(recentWindow)

  const totalsQuery = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN hazardous THEN 1 ELSE 0 END) AS hazardous
    FROM neo_flyby
    ${baseWhere}
  `
  const recentQuery = `
    SELECT COUNT(*) AS recent
    FROM neo_flyby
    ${recentWhere}
  `
  const dailyCountsQuery = `
    SELECT DATE_TRUNC('day', time) AS day_bucket, COUNT(*) AS count
    FROM neo_flyby
    ${baseWhere}
    GROUP BY day_bucket
    ORDER BY day_bucket ASC
  `
  const orbitQuery = `
    SELECT orbiting_body, COUNT(*) AS count
    FROM neo_flyby
    ${baseWhere}
    GROUP BY orbiting_body
  `

  const [totals, recent, perDay, perOrbit] = await Promise.all([
    collectRows(totalsQuery),
    collectRows(recentQuery),
    collectRows(dailyCountsQuery),
    collectRows(orbitQuery)
  ])

  const totalsRow = totals[0] ?? {total: 0, hazardous: 0}
  const recentRow = recent[0] ?? {recent: 0}

  return {
    total: Number(totalsRow.total ?? 0),
    hazardous: Number(totalsRow.hazardous ?? 0),
    recent: Number(recentRow.recent ?? 0),
    lastIngest: lastIngestTimestamp ? new Date(lastIngestTimestamp).toISOString() : null,
    countsByDay: perDay.map((row) => ({
      day: rowTimeToIso(row.day_bucket ?? row.day),
      count: Number(row.count ?? 0)
    })),
    byOrbit: perOrbit.map((row) => ({
      orbitingBody: row.orbiting_body ?? 'unknown',
      count: Number(row.count ?? 0)
    }))
  }
}

export const getLastIngestIso = () => (lastIngestTimestamp ? new Date(lastIngestTimestamp).toISOString() : null)
