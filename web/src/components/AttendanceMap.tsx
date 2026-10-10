import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { divIcon } from 'leaflet'
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
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

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

/**
 * Site pins are CSS-drawn divIcons: the stock Leaflet PNG markers break under
 * bundlers, and a div pin picks the palette up automatically (light + dark).
 * The `.map-dark` class on the MapContainer inverts the tile pane in dark mode
 * — keyless dark cartography, since CARTO's dark basemap now requires an API key.
 */
const SITE_PIN = divIcon({
  className: '',
  html: '<span class="relay-pin"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

/**
 * Leaflet paints geometry through SVG attributes, which cannot resolve utility
 * classes — resolve the chart token from the theme once at module load (the
 * value is identical in both themes). Cartography colour, like the tiles.
 */
function readToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}
const GEOFENCE_COLOR = readToken('--chart-3', '#64748b')

/**
 * Leaflet renders its own popup chrome — theme it via descendant variants.
 * `!` is required: Leaflet's own stylesheet is unlayered, so un-important
 * utilities would lose the cascade against `background:#fff` etc.
 */
const POPUP_THEME =
  '[&_.leaflet-popup-content-wrapper]:rounded-lg [&_.leaflet-popup-content-wrapper]:border [&_.leaflet-popup-content-wrapper]:border-border [&_.leaflet-popup-content-wrapper]:bg-popover! [&_.leaflet-popup-content-wrapper]:text-popover-foreground! [&_.leaflet-popup-content-wrapper]:shadow-sm [&_.leaflet-popup-tip]:bg-popover! [&_.leaflet-popup-close-button]:text-muted-foreground!'

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
  const { theme } = useTheme()

  return (
    <MapContainer
      center={center}
      zoom={points.length > 0 ? 13 : 5}
      scrollWheelZoom
      className={cn('z-0 h-96 w-full', theme === 'dark' && 'map-dark', className)}
    >
      <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} />
      <FitBounds points={points} />
      {sites.map((site) => (
        <Circle
          key={site.id}
          center={[site.lat, site.lng]}
          radius={site.radiusM}
          pathOptions={{
            color: GEOFENCE_COLOR,
            weight: 2,
            fillColor: GEOFENCE_COLOR,
            fillOpacity: 0.1,
          }}
        >
          <Popup className={POPUP_THEME}>
            <div className="text-sm font-medium text-foreground">{site.name}</div>
            <div className="tnum text-xs text-muted-foreground">
              Geofence radius {site.radiusM} m
            </div>
          </Popup>
        </Circle>
      ))}
      {sites.map((site) => (
        <Marker key={`${site.id}-pin`} position={[site.lat, site.lng]} icon={SITE_PIN}>
          <Popup className={POPUP_THEME}>
            <span className="text-sm font-medium text-foreground">{site.name}</span>
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
          <Popup className={POPUP_THEME}>
            <div className="text-sm font-medium text-foreground">{marker.title}</div>
            {marker.lines.map((line) => (
              <div key={line} className="text-xs text-muted-foreground">
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
  const { theme } = useTheme()
  return (
    <div className="relative z-0 h-64 overflow-hidden rounded-lg border">
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        scrollWheelZoom
        className={cn('h-full w-full', theme === 'dark' && 'map-dark')}
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
          icon={SITE_PIN}
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
            color: GEOFENCE_COLOR,
            weight: 2,
            fillColor: GEOFENCE_COLOR,
            fillOpacity: 0.16,
          }}
        />
        <SyncView lat={lat} lng={lng} skipRef={mapSourced} />
      </MapContainer>
    </div>
  )
}
