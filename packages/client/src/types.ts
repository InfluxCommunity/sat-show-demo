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
