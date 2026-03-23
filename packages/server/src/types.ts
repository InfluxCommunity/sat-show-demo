export interface NearEarthObject {
  id: string
  neo_reference_id: string
  name: string
  nasa_jpl_url: string
  absolute_magnitude_h: number
  estimated_diameter: {
    kilometers: {
      estimated_diameter_min: number
      estimated_diameter_max: number
    }
  }
  is_potentially_hazardous_asteroid: boolean
  close_approach_data: CloseApproach[]
}

export interface CloseApproach {
  close_approach_date: string
  close_approach_date_full?: string
  epoch_date_close_approach?: number
  relative_velocity: {
    kilometers_per_second: string
    kilometers_per_hour: string
    miles_per_hour: string
  }
  miss_distance: {
    astronomical: string
    lunar: string
    kilometers: string
    miles: string
  }
  orbiting_body: string
}

export interface NeoBrowseResponse {
  near_earth_objects: NearEarthObject[]
}

export interface NeoFeedResponse {
  near_earth_objects: Record<string, NearEarthObject[]>
}

export interface NeoPointDTO {
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

export interface NeoSummaryDTO {
  total: number
  hazardous: number
  recent: number
  lastIngest: string | null
  countsByDay: Array<{ day: string; count: number }>
  byOrbit: Array<{ orbitingBody: string; count: number }>
}

export interface TimeWindow {
  from?: string
  to?: string
}

export interface SatelliteDTO {
  satId: string
  name: string
  objectType: string
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

export interface SatelliteSummaryDTO {
  total: number
  types: SatelliteSummaryBucket[]
  statuses: SatelliteSummaryBucket[]
  countries: SatelliteSummaryBucket[]
  shells: SatelliteSummaryBucket[]
}

export interface SatelliteFilters {
  types?: string[]
  minAlt?: number
  maxAlt?: number
  shell?: string
}
