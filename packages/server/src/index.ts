import cors from 'cors'
import express from 'express'
import {appConfig, validateConfig} from './config'
import {closeInfluxClient} from './influxClient'
import {fetchNeoPoints, fetchNeoSummary, getLastIngestIso, scheduleIngest, triggerIngest} from './neoService'
import {fetchSatellites, fetchSatelliteSummary} from './satelliteService'
import {runSqlQuery} from './queryUtils'

const parseDateParam = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return undefined
  }
  return new Date(timestamp).toISOString()
}

const extractWindow = (query: Record<string, unknown>) => {
  const from = parseDateParam(query.from)
  const to = parseDateParam(query.to)
  if (!from && !to) {
    return undefined
  }
  return {from, to}
}

const parseNumberParam = (value: unknown): number | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseListParam = (value: unknown): string[] | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const list = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return list.length ? list : undefined
}

validateConfig()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({status: 'ok', lastIngest: getLastIngestIso()})
})

app.get('/api/neos', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 40)
    const window = extractWindow(req.query as Record<string, unknown>)
    const data = await fetchNeoPoints(Number.isFinite(limit) ? limit : 40, window)
    res.json({data, lastIngest: getLastIngestIso()})
  } catch (error) {
    next(error)
  }
})

app.get('/api/summary', async (req, res, next) => {
  try {
    const window = extractWindow(req.query as Record<string, unknown>)
    const summary = await fetchNeoSummary(window)
    res.json(summary)
  } catch (error) {
    next(error)
  }
})

app.post('/api/ingest', async (_req, res, next) => {
  try {
    const result = await triggerIngest()
    res.json({...result, lastIngest: getLastIngestIso()})
  } catch (error) {
    next(error)
  }
})

app.get('/api/satellites', async (req, res, next) => {
  try {
    const limit = parseNumberParam(req.query.limit) ?? 1500
    const types = parseListParam(req.query.types)
    const minAlt = parseNumberParam(req.query.minAlt)
    const maxAlt = parseNumberParam(req.query.maxAlt)
    const shell = typeof req.query.shell === 'string' ? req.query.shell.trim() : undefined
    const data = await fetchSatellites(limit, {types, minAlt, maxAlt, shell})
    res.json({data, generatedAt: new Date().toISOString()})
  } catch (error) {
    next(error)
  }
})

app.get('/api/satellites/summary', async (_req, res, next) => {
  try {
    const summary = await fetchSatelliteSummary()
    res.json(summary)
  } catch (error) {
    next(error)
  }
})

app.post('/api/query', async (req, res, next) => {
  try {
    const {sql} = req.body ?? {}
    if (typeof sql !== 'string' || !sql.trim()) {
      res.status(400).json({message: 'SQL string is required'})
      return
    }
    const result = await runSqlQuery(sql)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({message: err.message ?? 'Unexpected error'})
})

const server = app.listen(appConfig.server.port, () => {
  console.log(`Server listening on http://localhost:${appConfig.server.port}`)
})

const ingestTimer = scheduleIngest(appConfig.server.ingestIntervalMs, console)

const shutdown = () => {
  console.log('Shutting down...')
  clearInterval(ingestTimer)
  closeInfluxClient()
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
