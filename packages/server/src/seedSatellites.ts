import {Point} from '@influxdata/influxdb3-client'
import {appConfig} from './config'
import {closeInfluxClient, influxClient} from './influxClient'

const EARTH_RADIUS_KM = 6371
const EARTH_GRAVITATIONAL_CONSTANT = 398600.4418 // km^3/s^2
const MEASUREMENT = 'sat_objects'

const objectTypes = ['payload', 'rocket_body', 'debris', 'unknown'] as const
const statuses = ['Operational', 'Standby', 'Drift', 'Decay risk', 'De-orbit command']
const countries = ['USA', 'China', 'Russia', 'India', 'Japan', 'France', 'UK', 'ESA', 'Private']
const operators = ['AstraLink', 'OrbitalNet', 'GeoScan', 'LunaTel', 'Atlas Defense', 'SkyWorks', 'GlobalView']

interface ShellConfig {
  id: string
  altitudeRange: [number, number]
  inclinationRange: [number, number]
  typeBias: Partial<Record<(typeof objectTypes)[number], number>>
  color: string
  threatBase: number
}

const shells: ShellConfig[] = [
  {
    id: 'LEO-Comm',
    altitudeRange: [510, 580],
    inclinationRange: [50, 56],
    typeBias: {payload: 0.9},
    color: '#4ade80',
    threatBase: 0.18
  },
  {
    id: 'LEO-ISR',
    altitudeRange: [600, 750],
    inclinationRange: [85, 99],
    typeBias: {payload: 0.75, rocket_body: 0.15},
    color: '#38bdf8',
    threatBase: 0.32
  },
  {
    id: 'LEO-Debris',
    altitudeRange: [650, 1100],
    inclinationRange: [40, 120],
    typeBias: {debris: 0.8},
    color: '#fb7185',
    threatBase: 0.65
  },
  {
    id: 'MEO-NAV',
    altitudeRange: [19000, 23000],
    inclinationRange: [52, 64],
    typeBias: {payload: 0.7, rocket_body: 0.2},
    color: '#fbbf24',
    threatBase: 0.25
  },
  {
    id: 'GEO-Station',
    altitudeRange: [35750, 35850],
    inclinationRange: [0, 5],
    typeBias: {payload: 0.8, unknown: 0.2},
    color: '#c084fc',
    threatBase: 0.15
  }
]

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min
const randomChoice = <T>(values: T[]): T => values[Math.floor(Math.random() * values.length)]

const pickObjectType = (shell: ShellConfig) => {
  const roll = Math.random()
  let cumulative = 0
  const entries = objectTypes.map((type) => ({
    type,
    weight: shell.typeBias[type] ?? 0.25
  }))
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  for (const entry of entries) {
    cumulative += entry.weight / total
    if (roll <= cumulative) {
      return entry.type
    }
  }
  return 'unknown'
}

const computePeriodMinutes = (altitudeKm: number) => {
  const semiMajorAxis = EARTH_RADIUS_KM + altitudeKm
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / EARTH_GRAVITATIONAL_CONSTANT)
  return periodSeconds / 60
}

const computeVelocityKps = (altitudeKm: number) => {
  const radius = EARTH_RADIUS_KM + altitudeKm
  return Math.sqrt(EARTH_GRAVITATIONAL_CONSTANT / radius)
}

const formatSatId = (index: number) => `SAT-${(index + 1).toString().padStart(4, '0')}`

const buildSatellitePoint = (index: number): Point => {
  const shell = randomChoice(shells)
  const altitudeKm = randomBetween(shell.altitudeRange[0], shell.altitudeRange[1])
  const perigeeKm = altitudeKm - randomBetween(5, 45)
  const apogeeKm = altitudeKm + randomBetween(5, 45)
  const inclinationDeg = randomBetween(shell.inclinationRange[0], shell.inclinationRange[1])
  const raanDeg = randomBetween(0, 360)
  const phaseDeg = randomBetween(0, 360)
  const periodMin = computePeriodMinutes(altitudeKm)
  const velocityKps = computeVelocityKps(altitudeKm)
  const objectType = pickObjectType(shell)
  const satId = formatSatId(index)
  const threatScore = Number((shell.threatBase + Math.random() * 0.6).toFixed(3))
  const radarCrossSection = Number(randomBetween(0.12, 5.8).toFixed(2))
  const status = randomChoice(statuses)
  const country = randomChoice(countries)
  const operator = randomChoice(operators)
  const lastContact = new Date(Date.now() - randomBetween(10 * 60 * 1000, 18 * 60 * 60 * 1000)).toISOString()

  return Point.measurement(MEASUREMENT)
    .setTag('sat_id', satId)
    .setTag('object_type', objectType)
    .setTag('country', country)
    .setTag('operator', operator)
    .setTag('shell', shell.id)
    .setStringField('name', `${shell.id}-${satId}`)
    .setStringField('status', status)
    .setFloatField('altitude_km', Number(altitudeKm.toFixed(2)))
    .setFloatField('perigee_km', Number(perigeeKm.toFixed(2)))
    .setFloatField('apogee_km', Number(apogeeKm.toFixed(2)))
    .setFloatField('inclination_deg', Number(inclinationDeg.toFixed(2)))
    .setFloatField('raan_deg', Number(raanDeg.toFixed(2)))
    .setFloatField('phase_deg', Number(phaseDeg.toFixed(2)))
    .setFloatField('period_min', Number(periodMin.toFixed(2)))
    .setFloatField('velocity_kps', Number(velocityKps.toFixed(3)))
    .setFloatField('threat_score', threatScore)
    .setFloatField('radar_cross_section', radarCrossSection)
    .setStringField('color_hex', shell.color)
    .setStringField('last_contact', lastContact)
    .setTimestamp(new Date())
}

const run = async () => {
  if (!appConfig.influx.database) {
    throw new Error('INFLUX_DATABASE must be set (e.g. my_demo_db)')
  }
  const countArg = process.argv[2]
  const count = Number.isFinite(Number(countArg)) ? Math.max(100, Number(countArg)) : 1500
  const points: Point[] = []
  for (let i = 0; i < count; i += 1) {
    points.push(buildSatellitePoint(i))
  }
  console.log(`[seed] Writing ${points.length} synthetic satellites into ${appConfig.influx.database}.${MEASUREMENT}`)
  await influxClient.write(points, appConfig.influx.database)
  closeInfluxClient()
  console.log('[seed] Complete.')
}

run().catch((error) => {
  console.error('[seed] Failed:', error)
  closeInfluxClient()
  process.exit(1)
})
