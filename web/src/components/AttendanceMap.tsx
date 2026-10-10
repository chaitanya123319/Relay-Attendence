import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { LatLngExpression, Marker as LeafletMarker } from 'leaflet'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { cn } from '../lib/utils'

export interface MapSite {
  id: string
  name: string
  lat: number
  lng: number
  radiusM: number
}

export interface MapMarker {
  id: string
  lat: number
  lng: number
  color: string
  title: string
  lines: string[]
}

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629] // India centroid
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    map.fitBounds(points, { padding: [40, 40], maxZoom: 16 })
  }, [map, points])
  return null
}

/** Read-only map: site geofence circles + check-in markers (Team Today page). */
export default function AttendanceMap({
  sites,
  markers,
  className,
}: {
  sites: MapSite[]
  markers: MapMarker[]
  className?: string
}) {
  const points = useMemo<Array<[number, number]>>(() => {
    const pts: Array<[number, number]> = sites.map((s) => [s.lat, s.lng])
    for (const m of markers) pts.push([m.lat, m.lng])
    return pts
  }, [sites, markers])

  const center: LatLngExpression = points[0] ?? DEFAULT_CENTER

  return (
    <MapContainer
      center={center}
      zoom={points.length > 0 ? 13 : 5}
      scrollWheelZoom
      className={cn('h-full w-full', className)}
    >
      <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} />
      <FitBounds points={points} />
      {sites.map((site) => (
        <Circle
          key={site.id}
          center={[site.lat, site.lng]}
          radius={site.radiusM}
          pathOptions={{
            color: '#4f46e5',
            weight: 1.5,
            fillColor: '#6366f1',
            fillOpacity: 0.08,
          }}
        >
          <Popup>
            <div className="text-sm font-medium">{site.name}</div>
            <div className="text-xs text-slate-500">Geofence radius {site.radiusM} m</div>
          </Popup>
        </Circle>
      ))}
      {sites.map((site) => (
        <Marker key={`${site.id}-pin`} position={[site.lat, site.lng]}>
          <Popup>
            <span className="text-sm font-medium">{site.name}</span>
          </Popup>
        </Marker>
      ))}
      {markers.map((marker) => (
        <CircleMarker
          key={marker.id}
          center={[marker.lat, marker.lng]}
          radius={8}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: marker.color, fillOpacity: 1 }}
        >
          <Popup>
            <div className="text-sm font-medium">{marker.title}</div>
            {marker.lines.map((line) => (
              <div key={line} className="text-xs text-slate-500">
                {line}
              </div>
            ))}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}

/* ── editable map for the site form: click to pick, drag to move ────────── */

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  })
  return null
}

function SyncView({
  lat,
  lng,
  skipRef,
}: {
  lat: number
  lng: number
  skipRef: MutableRefObject<boolean>
}) {
  const map = useMap()
  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false
      return
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 12))
  }, [lat, lng, map, skipRef])
  return null
}

/** Click anywhere on the map (or drag the pin) to set coordinates; inputs stay in sync. */
export function SiteFormMap({
  lat,
  lng,
  radiusM,
  onPick,
}: {
  lat: number
  lng: number
  radiusM: number
  onPick: (lat: number, lng: number) => void
}) {
  const mapSourced = useRef(false)
  return (
    <div className="relative z-0 h-64 overflow-hidden rounded-lg border border-slate-200">
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} />
        <ClickToPick
          onPick={(la, ln) => {
            mapSourced.current = true
            onPick(la, ln)
          }}
        />
        <Marker
          draggable
          position={[lat, lng]}
          eventHandlers={{
            dragend: (event) => {
              const marker = event.target as LeafletMarker
              const pos = marker.getLatLng()
              mapSourced.current = true
              onPick(pos.lat, pos.lng)
            },
          }}
        />
        <Circle
          center={[lat, lng]}
          radius={radiusM}
          pathOptions={{
            color: '#4f46e5',
            weight: 1.5,
            fillColor: '#6366f1',
            fillOpacity: 0.12,
          }}
        />
        <SyncView lat={lat} lng={lng} skipRef={mapSourced} />
      </MapContainer>
    </div>
  )
}
