import {InfluxDBClient} from '@influxdata/influxdb3-client'
import {appConfig} from './config'

export const influxClient = new InfluxDBClient({
  host: appConfig.influx.url,
  token: appConfig.influx.token,
  database: appConfig.influx.database
})

export const closeInfluxClient = () => {
  influxClient.close()
}
