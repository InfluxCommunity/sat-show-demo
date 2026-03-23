import {useEffect, useRef} from 'react'
import * as THREE from 'three'
import Globe from 'globe.gl'
import type {SatellitePoint} from '../types'
import {STATUS_META, categorizeStatus} from '../utils/status'
import type {StatusCategory} from '../utils/status'

interface GlobeViewProps {
  satellites: SatellitePoint[]
  highlightedId?: string | null
  speed: number
  onSelect?: (satellite: SatellitePoint) => void
  overlayLabel?: string | null
}

interface RenderPoint {
  sat: SatellitePoint
  id: string
  lat: number
  lng: number
  altitude: number
  category: StatusCategory
  sprite?: THREE.Sprite
  isActive: boolean
  scale: number
}

interface TextureBundle {
  globe: string
  bump: string
  background: string
}

type SpriteMap = Record<StatusCategory, THREE.SpriteMaterial>

const DAY_MS = 24 * 60 * 60 * 1000

const degToRad = (value: number) => (value * Math.PI) / 180
const radToDeg = (value: number) => (value * 180) / Math.PI

const computeGeoPosition = (sat: SatellitePoint, timestamp: number, speed: number) => {
  const altitudeKm = Math.max(160, sat.altitudeKm || 400)
  const periodMs = Math.max(20, sat.periodMin || 95) * 60 * 1000
  const basePhase = ((sat.phaseDeg ?? 0) % 360) / 360
  const normalizedSpeed = Math.max(0.2, speed / 25)
  const orbitFraction = (basePhase + ((timestamp * normalizedSpeed) % periodMs) / periodMs) % 1
  const trueAnomaly = orbitFraction * 2 * Math.PI
  const inc = degToRad(sat.inclinationDeg || 0)
  const raan = degToRad(sat.raanDeg || 0)
  const cosInc = Math.cos(inc)
  const sinInc = Math.sin(inc)
  const cosRAAN = Math.cos(raan)
  const sinRAAN = Math.sin(raan)

  const xOrbit = Math.cos(trueAnomaly)
  const yOrbit = Math.sin(trueAnomaly)

  const xEci = xOrbit * cosRAAN - yOrbit * sinRAAN * cosInc
  const yEci = xOrbit * sinRAAN + yOrbit * cosRAAN * cosInc
  const zEci = yOrbit * sinInc

  const earthRotation = ((timestamp % DAY_MS) / DAY_MS) * 2 * Math.PI
  const cosEarth = Math.cos(earthRotation)
  const sinEarth = Math.sin(earthRotation)

  const x = xEci * cosEarth + yEci * sinEarth
  const y = -xEci * sinEarth + yEci * cosEarth
  const z = zEci

  const lat = radToDeg(Math.asin(Math.max(-1, Math.min(1, z))))
  let lon = radToDeg(Math.atan2(y, x))
  if (lon > 180) {
    lon -= 360
  } else if (lon < -180) {
    lon += 360
  }

  const altitude = Math.min(0.35, Math.max(0.05, (altitudeKm - 160) / 42000))

  return {lat, lon, altitude}
}

const SAMPLE_SIZE = 900

const buildRenderPoints = (satellites: SatellitePoint[]): RenderPoint[] => {
  const filtered = satellites.slice(0, SAMPLE_SIZE)
  return filtered.map((sat) => ({
    sat,
    id: sat.satId,
    lat: 0,
    lng: 0,
    altitude: 0.08,
    category: categorizeStatus(sat.status),
    sprite: undefined,
    isActive: false,
    scale: Math.max(9, Math.min(14, sat.radarCrossSection * 1.2 + 9))
  }))
}

const createCanvasTexture = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return ''
  }
  draw(ctx)
  return canvas.toDataURL('image/png')
}

const createEarthTexture = () => {
  return createCanvasTexture(2048, 1024, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height)
    gradient.addColorStop(0, '#0c193d')
    gradient.addColorStop(0.45, '#062347')
    gradient.addColorStop(1, '#011026')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    ctx.fillStyle = '#0f5132'
    for (let i = 0; i < 1200; i += 1) {
      const x = Math.random() * ctx.canvas.width
      const y = Math.random() * ctx.canvas.height
      const radius = Math.random() * 28 + 6
      ctx.globalAlpha = 0.12 + Math.random() * 0.1
      ctx.beginPath()
      ctx.ellipse(x, y, radius * 1.2, radius, Math.random() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  })
}

const createBumpTexture = () => {
  return createCanvasTexture(1024, 512, (ctx) => {
    ctx.fillStyle = '#1b1f3b'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.fillStyle = '#2c2f4f'
    for (let i = 0; i < 10000; i += 1) {
      const x = Math.random() * ctx.canvas.width
      const y = Math.random() * ctx.canvas.height
      const size = Math.random() * 2
      ctx.globalAlpha = 0.05 + Math.random() * 0.1
      ctx.fillRect(x, y, size, size)
    }
    ctx.globalAlpha = 1
  })
}
const createBackgroundTexture = () => {
  return createCanvasTexture(2048, 1024, (ctx) => {
    const gradient = ctx.createRadialGradient(1024, 512, 250, 1024, 512, 1200)
    gradient.addColorStop(0, '#020617')
    gradient.addColorStop(1, '#000000')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    const starColors = ['#ffffff', '#f9fafb', '#e0f2fe']
    for (let i = 0; i < 3200; i += 1) {
      const x = Math.random() * ctx.canvas.width
      const y = Math.random() * ctx.canvas.height
      const size = Math.random() * 1.1 + 0.2
      ctx.globalAlpha = 0.25 + Math.random() * 0.6
      ctx.fillStyle = starColors[Math.floor(Math.random() * starColors.length)]
      ctx.fillRect(x, y, size, size)
    }
    ctx.globalAlpha = 1
  })
}

const createTextureBundle = (): TextureBundle => ({
  globe: createEarthTexture(),
  bump: createBumpTexture(),
  background: createBackgroundTexture()
})

const createSpriteMaterials = (): SpriteMap => ({
  active: createSpriteMaterial('active'),
  warning: createSpriteMaterial('warning'),
  inactive: createSpriteMaterial('inactive')
})

const createSpriteMaterial = (category: StatusCategory): THREE.SpriteMaterial => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return new THREE.SpriteMaterial({color: STATUS_META[category].color})
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = STATUS_META[category].color
  ctx.strokeStyle = 'rgba(6, 6, 15, 0.85)'
  ctx.lineWidth = 2
  if (category === 'active') {
    ctx.beginPath()
    ctx.arc(32, 32, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(32, 32, 4, 0, Math.PI * 2)
    ctx.fill()
  } else if (category === 'warning') {
    ctx.beginPath()
    ctx.moveTo(32, 14)
    ctx.lineTo(20, 48)
    ctx.lineTo(44, 48)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(30, 26, 4, 10)
    ctx.fillRect(30, 40, 4, 4)
  } else {
    ctx.fillRect(22, 22, 18, 18)
    ctx.strokeRect(22, 22, 18, 18)
    ctx.strokeStyle = '#0f172a'
    ctx.beginPath()
    ctx.moveTo(24, 24)
    ctx.lineTo(40, 40)
    ctx.moveTo(40, 24)
    ctx.lineTo(24, 40)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return new THREE.SpriteMaterial({map: texture, transparent: true})
}

export const GlobeView = ({satellites, highlightedId, speed, onSelect, overlayLabel}: GlobeViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeRef = useRef<ReturnType<typeof Globe> | null>(null)
  const pointsRef = useRef<RenderPoint[]>([])
  const animationRef = useRef<number>()
  const speedRef = useRef(speed)
  const texturesRef = useRef<TextureBundle | null>(null)
  const spriteMaterialsRef = useRef<SpriteMap | null>(null)
  const onSelectRef = useRef<typeof onSelect>()

  const applySpriteState = (point: RenderPoint) => {
    if (!globeRef.current || !point.sprite) {
      return
    }
    const coords = globeRef.current.getCoords(point.lat, point.lng, point.altitude)
    if (coords) {
      point.sprite.position.set(coords.x, coords.y, coords.z)
    }
    const size = point.isActive ? 16 : 11
    point.sprite.scale.set(size, size, 1)
    point.sprite.material.opacity = point.category === 'inactive' ? 0.8 : 1
  }

  const clearSprites = () => {
    pointsRef.current.forEach((point) => {
      point.sprite = undefined
    })
  }

  useEffect(() => {
    pointsRef.current = buildRenderPoints(satellites)
    if (globeRef.current) {
      globeRef.current.customLayerData(pointsRef.current)
    }
  }, [satellites])

  useEffect(() => {
    if (!globeRef.current) {
      return
    }
    pointsRef.current.forEach((point) => {
      point.isActive = Boolean(highlightedId && point.id === highlightedId)
      applySpriteState(point)
    })
  }, [highlightedId])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    if (!texturesRef.current) {
      texturesRef.current = createTextureBundle()
    }
    if (!spriteMaterialsRef.current) {
      spriteMaterialsRef.current = createSpriteMaterials()
    }
    const materials = spriteMaterialsRef.current
    const textures = texturesRef.current

    const globe = Globe()(container)
      .globeImageUrl(textures.globe)
      .bumpImageUrl(textures.bump)
      .backgroundImageUrl(textures.background)
      .pointOfView({lat: 15, lng: -90, altitude: 2.5}, 0)
      .customLayerData(pointsRef.current)
      .customThreeObject((point: RenderPoint) => {
        const sprite = new THREE.Sprite(materials[point.category])
        sprite.material.depthTest = false
        sprite.renderOrder = 3
        sprite.userData.point = point
        point.sprite = sprite
        applySpriteState(point)
        return sprite
      })
      .customLayerLabel((point: RenderPoint) => `${point.sat.name} • ${STATUS_META[point.category].label}`)

    globe.controls().autoRotate = true
    globe.controls().autoRotateSpeed = 0.35
    globe.controls().enableZoom = true
    globe.controls().minDistance = 140
    globe.controls().maxDistance = 900

    globe.onCustomLayerClick((object) => {
      const handler = onSelectRef.current
      const renderPoint = (object?.userData?.point as RenderPoint | undefined) ?? null
      if (handler && renderPoint) {
        handler(renderPoint.sat)
      }
    })
    globe.onCustomLayerHover((object) => {
      const handler = onSelectRef.current
      const renderPoint = (object?.userData?.point as RenderPoint | undefined) ?? null
      if (handler && renderPoint) {
        handler(renderPoint.sat)
      }
    })

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry && globeRef.current) {
          globeRef.current.width(entry.contentRect.width)
          globeRef.current.height(entry.contentRect.height)
        }
      })
      resizeObserver.observe(container)
      globeRef.current = globe
      return () => {
        resizeObserver.disconnect()
        clearSprites()
        globeRef.current = null
        container.innerHTML = ''
      }
    }

    globeRef.current = globe
    return () => {
      clearSprites()
      globeRef.current = null
      container.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    const updatePoints = () => {
      const now = Date.now()
      pointsRef.current.forEach((point) => {
        const position = computeGeoPosition(point.sat, now, speedRef.current)
        point.lat = position.lat
        point.lng = position.lon
        point.altitude = 0.08 + position.altitude
        applySpriteState(point)
      })
      animationRef.current = requestAnimationFrame(updatePoints)
    }

    animationRef.current = requestAnimationFrame(updatePoints)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  useEffect(
    () => () => {
      if (spriteMaterialsRef.current) {
        Object.values(spriteMaterialsRef.current).forEach((material) => {
          material.map?.dispose()
          material.dispose()
        })
      }
    },
    []
  )

  return (
    <div className="globe-view" ref={containerRef}>
      {overlayLabel && <div className="globe-overlay">{overlayLabel}</div>}
    </div>
  )
}
