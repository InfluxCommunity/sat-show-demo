import {appConfig} from './config'
import {influxClient} from './influxClient'

export const rowTimeToIso = (timeValue: any): string => {
  if (!timeValue) {
    return ''
  }
  if (typeof timeValue === 'string') {
    return timeValue
  }
  if (timeValue instanceof Date) {
    return timeValue.toISOString()
  }
  if (typeof timeValue === 'number') {
    return new Date(timeValue).toISOString()
  }
  return new Date(timeValue).toISOString()
}

export const collectRows = async (query: string): Promise<Record<string, any>[]> => {
  try {
    const rows: Record<string, any>[] = []
    const iterator = await influxClient.query(query, appConfig.influx.database)
    for await (const row of iterator as AsyncIterable<Record<string, any>>) {
      rows.push(row)
    }
    return rows
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/not found/i.test(message)) {
      return []
    }
    throw error
  }
}

export const runSqlQuery = async (sql: string) => {
  const rows = await collectRows(sql)
  const columns = rows.length ? Object.keys(rows[0]) : []
  return {columns, rows}
}
