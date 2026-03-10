import {Suspense, useMemo} from 'react'
import * as THREE from 'three'
import {Canvas} from '@react-three/fiber'
import {OrbitControls, Stars} from '@react-three/drei'
import type {NeoPoint} from '../types'

interface GlobeSceneProps {
  points: NeoPoint[]
  onSelect: (point: NeoPoint) => void
  highlightedId?: string
}

type Marker = NeoPoint & {position: [number, number, number]; scale: number}

const EARTH_RADIUS = 3
const toRadians = (value: number) => (value * Math.PI) / 180

const latLonToCartesian = (lat: number, lon: number, radius: number): [number, number, number] => {
  const phi = toRadians(90 - lat)
  const theta = toRadians(lon + 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return [x, y, z]
}

const buildMarkers = (points: NeoPoint[]): Marker[] => {
  return points.map((point, index) => {
    const baseSeed = point.neoId.split('').reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 11), 0)
    const lat = ((baseSeed % 180) - 90) + Math.sin(index) * 4
    const lon = (((baseSeed / 3) % 360) - 180) + (point.hazardous ? 6 : 0)
    const altitude = EARTH_RADIUS + 0.35 + Math.min(point.riskScore / 400, 1) * 0.9
    const position = latLonToCartesian(lat, lon, altitude)
    const scale = 0.12 + Math.min(point.diameterKm, 1.2) * 0.05
    return {...point, position, scale}
  })
}

const createEarthTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return new THREE.Texture()
  }
  ctx.fillStyle = '#071629'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0d3352'
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#0b3354')
  gradient.addColorStop(1, '#040c1b')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#2fb072'
  for (let i = 0; i < 180; i += 1) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    const radius = Math.random() * 80 + 20
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 0.15
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 120; i += 1) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    const radius = Math.random() * 60 + 10
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

const Earth = () => {
  const colorMap = useMemo(() => createEarthTexture(), [])
  return (
    <mesh rotation={[0.3, 0.9, 0]}>
      <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
      <meshStandardMaterial map={colorMap} metalness={0.25} roughness={0.95} />
    </mesh>
  )
}

const Atmosphere = () => (
  <mesh rotation={[0.3, 0.9, 0]}>
    <sphereGeometry args={[EARTH_RADIUS + 0.12, 128, 128]} />
    <meshPhongMaterial color="#60a5fa" transparent opacity={0.18} shininess={5} emissive="#3b82f6" />
  </mesh>
)

const MarkerLayer = ({
  markers,
  highlightedId,
  onSelect
}: {
  markers: Marker[]
  highlightedId?: string
  onSelect: (point: NeoPoint) => void
}) => (
  <>
    {markers.map((marker) => {
      const active = marker.approachId === highlightedId
      const color = marker.hazardous ? '#fb7185' : '#5eead4'
      return (
        <mesh
          key={marker.approachId}
          position={marker.position}
          scale={active ? marker.scale * 1.45 : marker.scale}
          onClick={() => onSelect(marker)}
          onPointerOver={() => onSelect(marker)}
        >
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={active ? '#f97316' : color}
            emissiveIntensity={active ? 1.4 : 0.5}
            roughness={0.35}
          />
        </mesh>
      )
    })}
  </>
)

export const GlobeScene = ({points, onSelect, highlightedId}: GlobeSceneProps) => {
  const markers = useMemo(() => buildMarkers(points), [points])

  return (
    <Canvas camera={{position: [0, 0, 9], fov: 42}} className="globe-canvas" shadows>
      <color attach="background" args={['#01030a']} />
      <fog attach="fog" args={['#01030a', 25, 60]} />
      <Stars radius={120} depth={50} count={7000} factor={4} fade speed={1} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 8]} intensity={1} castShadow />
      <Suspense fallback={null}>
        <Earth />
        <Atmosphere />
        <MarkerLayer markers={markers} onSelect={onSelect} highlightedId={highlightedId} />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom minDistance={5.5} maxDistance={14} />
    </Canvas>
  )
}
