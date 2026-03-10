import path from 'path'
import {config as loadEnv} from 'dotenv'

const envPath = path.resolve(__dirname, '../.env')
loadEnv({path: envPath})
loadEnv()

const numberFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const appConfig = {
  nasa: {
    apiKey: process.env.NASA_API_KEY?.trim() ?? ''
  },
  influx: {
    url: process.env.INFLUX_URL?.trim() ?? 'http://localhost:8181',
    token: process.env.INFLUX_TOKEN?.trim() ?? '',
    database: process.env.INFLUX_DATABASE?.trim() ?? ''
  },
  server: {
    port: numberFromEnv(process.env.SERVER_PORT, 4000),
    ingestIntervalMs: numberFromEnv(process.env.INGEST_INTERVAL_MS, 5 * 60 * 1000)
  }
}

export const validateConfig = () => {
  if (!appConfig.nasa.apiKey) {
    throw new Error('NASA_API_KEY is required to run the ingestion service')
  }
  if (!appConfig.influx.token || !appConfig.influx.database) {
    throw new Error('INFLUX_TOKEN and INFLUX_DATABASE are required')
  }
}
