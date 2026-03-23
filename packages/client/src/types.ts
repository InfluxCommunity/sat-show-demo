export interface NeoPoint {
  approachId: string
  neoId: string
  name: string
  orbitingBody: string
  hazardous: boolean
  magnitude: number
  diameterKm: number
  velocityKps: number
  missDistanceKm: number
  riskScore: number
  approachTime: string
  referenceUrl: string
}

export interface NeoSummary {
  total: number
  hazardous: number
  recent: number
  lastIngest: string | null
  countsByDay: Array<{day: string; count: number}>
  byOrbit: Array<{orbitingBody: string; count: number}>
}

export interface NeoResponse {
  data: NeoPoint[]
  lastIngest: string | null
}

export interface ApiError {
  message: string
}

export interface TimeWindow {
  from?: string
  to?: string
}

export type SatelliteObjectType = 'payload' | 'rocket_body' | 'debris' | 'unknown'

export interface SatellitePoint {
  satId: string
  name: string
  objectType: SatelliteObjectType | string
  shell: string
  country: string
  operator: string
  status: string
  altitudeKm: number
  perigeeKm: number
  apogeeKm: number
  inclinationDeg: number
  raanDeg: number
  phaseDeg: number
  periodMin: number
  velocityKps: number
  threatScore: number
  radarCrossSection: number
  colorHex: string
  timestamp: string
  lastContact: string
}

export interface SatelliteSummaryBucket {
  key: string
  count: number
}

export interface SatelliteSummary {
  total: number
  types: SatelliteSummaryBucket[]
  statuses: SatelliteSummaryBucket[]
  countries: SatelliteSummaryBucket[]
  shells: SatelliteSummaryBucket[]
}

export interface SatelliteResponse {
  data: SatellitePoint[]
  generatedAt: string
}

export interface SatelliteFilters {
  types: SatelliteObjectType[]
  altitudeRange: [number, number]
  shell?: string
  limit?: number
}

export interface SqlResultRow {
  [key: string]: unknown
}

export interface SqlQueryResult {
  columns: string[]
  rows: SqlResultRow[]
}
