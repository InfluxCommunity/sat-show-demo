import {useCallback, useEffect, useRef, useState} from 'react'
import {fetchNeoResponse, fetchSummaryResponse, requestManualIngest} from '../api'
import type {NeoPoint, NeoSummary, TimeWindow} from '../types'

interface DashboardState {
  points: NeoPoint[]
  summary: NeoSummary | null
  loading: boolean
  refreshing: boolean
  error: string | null
  lastUpdated: string | null
  ingesting: boolean
}

const initialState: DashboardState = {
  points: [],
  summary: null,
  loading: true,
  refreshing: false,
  error: null,
  lastUpdated: null,
  ingesting: false
}

export const useNeoDashboard = (windowRange: TimeWindow, refreshMs = 45000) => {
  const [state, setState] = useState<DashboardState>(initialState)
  const hasLoadedRef = useRef(false)

  const loadData = useCallback(
    async (forceLoading = false) => {
      setState((prev) => ({
        ...prev,
        loading: forceLoading ? true : prev.loading,
        refreshing: hasLoadedRef.current && !forceLoading ? true : prev.refreshing,
        error: forceLoading ? null : prev.error
      }))

      try {
        const [neoPayload, summaryPayload] = await Promise.all([
          fetchNeoResponse(windowRange),
          fetchSummaryResponse(windowRange)
        ])

        hasLoadedRef.current = true
        setState((prev) => ({
          ...prev,
          points: neoPayload.data,
          summary: summaryPayload,
          loading: false,
          refreshing: false,
          error: null,
          lastUpdated: new Date().toISOString()
        }))
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          refreshing: false,
          error: error instanceof Error ? error.message : 'Failed to load data'
        }))
      }
    },
    [windowRange]
  )

  useEffect(() => {
    loadData(true)
    const interval = setInterval(() => loadData(false), refreshMs)
    return () => clearInterval(interval)
  }, [loadData, refreshMs])

  const requestRefresh = useCallback(() => loadData(true), [loadData])

  const runManualIngest = useCallback(async () => {
    setState((prev) => ({...prev, ingesting: true}))
    try {
      await requestManualIngest()
      await loadData(true)
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to capture feed'
      }))
    } finally {
      setState((prev) => ({...prev, ingesting: false}))
    }
  }, [loadData])

  return {
    ...state,
    refresh: requestRefresh,
    ingest: runManualIngest
  }
}
