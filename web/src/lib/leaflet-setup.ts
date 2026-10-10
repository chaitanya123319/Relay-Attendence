import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

/**
 * Classic Vite + Leaflet gotcha: the default marker icon resolves its PNGs
 * relative to the CSS, which bundlers break. Point Leaflet at the bundled
 * asset URLs explicitly.
 */
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})
