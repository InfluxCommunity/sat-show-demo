import type {
  NeoResponse,
  NeoSummary,
  SatelliteFilters,
  SatelliteResponse,
  SatelliteSummary,
  SqlQueryResult,
  TimeWindow
} from './types'

const baseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000'

type QueryParams = Record<string, string | undefined>

interface RequestOptions extends RequestInit {
  params?: QueryParams
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const url = new URL(path, `${baseUrl}/`)
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value)
      }
    })
  }

  const {params: _params, ...init} = options
  void _params

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json'
    },
    ...init
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Request failed')
  }

  return response.json() as Promise<T>
}

const windowParams = (window?: TimeWindow): QueryParams | undefined => {
  if (!window) {
    return undefined
  }
  return {
    from: window.from,
    to: window.to
  }
}

export const fetchNeoResponse = (window?: TimeWindow) =>
  request<NeoResponse>('/api/neos', {params: windowParams(window)})
export const fetchSummaryResponse = (window?: TimeWindow) =>
  request<NeoSummary>('/api/summary', {params: windowParams(window)})
export const requestManualIngest = () =>
  request<{written: number; lastIngest: string | null}>('/api/ingest', {method: 'POST'})
export const runSqlQuery = (sql: string) =>
  request<SqlQueryResult>('/api/query', {method: 'POST', body: JSON.stringify({sql})})

const satelliteFilterParams = (filters: SatelliteFilters): QueryParams => {
  const params: QueryParams = {}
  if (filters.limit) {
    params.limit = String(filters.limit)
  }
  if (filters.shell) {
    params.shell = filters.shell
  }
  if (filters.types?.length) {
    params.types = filters.types.join(',')
  }
  if (typeof filters.altitudeRange?.[0] === 'number') {
    params.minAlt = String(filters.altitudeRange[0])
  }
  if (typeof filters.altitudeRange?.[1] === 'number') {
    params.maxAlt = String(filters.altitudeRange[1])
  }
  return params
}

export const fetchSatellites = (filters: SatelliteFilters) =>
  request<SatelliteResponse>('/api/satellites', {params: satelliteFilterParams(filters)})
export const fetchSatelliteSummary = () => request<SatelliteSummary>('/api/satellites/summary')
