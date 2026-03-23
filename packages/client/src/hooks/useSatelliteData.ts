import {useCallback, useEffect, useState} from 'react'
import {fetchSatelliteSummary, fetchSatellites} from '../api'
import type {SatelliteFilters, SatellitePoint, SatelliteSummary} from '../types'

interface SatelliteState {
  satellites: SatellitePoint[]
  summary: SatelliteSummary | null
  loading: boolean
  refreshing: boolean
  error: string | null
  lastUpdated: string | null
}

const initialState: SatelliteState = {
  satellites: [],
  summary: null,
  loading: true,
  refreshing: false,
  error: null,
  lastUpdated: null
}

export const useSatelliteData = (filters: SatelliteFilters, refreshMs = 45000) => {
  const [state, setState] = useState<SatelliteState>(initialState)
  const loadData = useCallback(
    async (forceLoading = false) => {
      setState((prev) => ({
        ...prev,
        loading: forceLoading ? true : prev.loading,
        refreshing: forceLoading ? false : true,
        error: forceLoading ? null : prev.error
      }))
      try {
        const [satResponse, summaryResponse] = await Promise.all([
          fetchSatellites(filters),
          fetchSatelliteSummary()
        ])
        setState({
          satellites: satResponse.data,
          summary: summaryResponse,
          loading: false,
          refreshing: false,
          error: null,
          lastUpdated: satResponse.generatedAt
        })
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          refreshing: false,
          error: error instanceof Error ? error.message : 'Failed to load satellite data'
        }))
      }
    },
    [filters]
  )

  useEffect(() => {
    loadData(true)
    const interval = setInterval(() => loadData(false), refreshMs)
    return () => clearInterval(interval)
  }, [loadData, refreshMs])

  const refresh = useCallback(() => loadData(true), [loadData])

  return {
    ...state,
    refresh
  }
}
