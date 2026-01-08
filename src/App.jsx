import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import jobs from './data/jobs.json'

// Leafletのデフォルトマーカー画像は、Vite環境だと解決できず表示されないことがあるため明示的に指定
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

function App() {
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const originMarkerRef = useRef(null)
  const circleRef = useRef(null)
  const jobsLayerRef = useRef(null)

  useEffect(() => {
    if (!mapElRef.current) return

    const tokyoStation = [35.681236, 139.767125]
    const map = L.map(mapElRef.current).setView(tokyoStation, 13)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    const jobsLayer = L.layerGroup().addTo(map)
    jobsLayerRef.current = jobsLayer

    const escapeHtml = (s) =>
      String(s).replace(/[&<>"']/g, (c) => {
        switch (c) {
          case '&':
            return '&amp;'
          case '<':
            return '&lt;'
          case '>':
            return '&gt;'
          case '"':
            return '&quot;'
          case "'":
            return '&#39;'
          default:
            return c
        }
      })

    const renderFromOrigin = (originLatLng) => {
      const origin = L.latLng(originLatLng)

      if (originMarkerRef.current) originMarkerRef.current.remove()
      if (circleRef.current) circleRef.current.remove()

      originMarkerRef.current = L.marker(origin).addTo(map).bindPopup('通勤起点')
      circleRef.current = L.circle(origin, {
        radius: 10000,
        color: '#2563eb',
        weight: 2,
        fillColor: '#60a5fa',
        fillOpacity: 0.15,
      }).addTo(map)

      jobsLayer.clearLayers()

      const inRange = jobs.filter((j) => {
        const p = L.latLng(j.lat, j.lng)
        return origin.distanceTo(p) <= 10000
      })

      inRange.forEach((j) => {
        L.marker([j.lat, j.lng])
          .addTo(jobsLayer)
          .bindPopup(`<b>${escapeHtml(j.title)}</b><br/>${escapeHtml(j.company)}`)
      })
    }

    const onClick = (e) => renderFromOrigin(e.latlng)
    map.on('click', onClick)

    return () => {
      map.off('click', onClick)
      map.remove()
      mapRef.current = null
      originMarkerRef.current = null
      circleRef.current = null
      jobsLayerRef.current = null
    }
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="title">通勤圏内の仕事情報マップ（MVP）</div>
        <div className="hint">地図をクリックして通勤起点を設定（半径10km）</div>
      </header>
      <div ref={mapElRef} className="map" />
    </div>
  )
}

export default App
