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

// StrictMode（開発時）でuseEffectが2回動くことがあるため、API呼び出しはモジュールスコープで1回に抑える
let adzunaJobsInFlight = null
let adzunaJobsCached = null

function App() {
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const originMarkerRef = useRef(null)
  const circleRef = useRef(null)
  const jobsLayerRef = useRef(null)
  const jobsRef = useRef(jobs)
  const lastOriginRef = useRef(null)

  useEffect(() => {
    if (!mapElRef.current) return

    // #region agent log
    const agentLog = (hypothesisId, location, message, data) => {
      fetch('http://127.0.0.1:7242/ingest/5d767aa7-d166-4b73-86bf-0027a7277891', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId,
          location,
          message,
          data,
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }
    // #endregion agent log

    const tokyoStation = [35.681236, 139.767125]
    const map = L.map(mapElRef.current).setView(tokyoStation, 13)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    const jobsLayer = L.layerGroup().addTo(map)
    jobsLayerRef.current = jobsLayer

    const loadJobsOnce = async () => {
      if (adzunaJobsCached) return adzunaJobsCached
      if (adzunaJobsInFlight) return adzunaJobsInFlight

      const appId = import.meta.env.VITE_ADZUNA_APP_ID
      const appKey = import.meta.env.VITE_ADZUNA_APP_KEY

      agentLog('H1', 'src/App.jsx:loadJobsOnce', 'env_checked', {
        hasAppId: Boolean(appId),
        hasAppKey: Boolean(appKey),
      })

      if (!appId || !appKey) {
        agentLog('H1', 'src/App.jsx:loadJobsOnce', 'env_missing_fallback_dummy', {})
        console.warn(
          '[Adzuna] VITE_ADZUNA_APP_ID / VITE_ADZUNA_APP_KEY が未設定のため、ダミーデータを使用します。',
        )
        return null
      }

      const url = new URL('https://api.adzuna.com/v1/api/jobs/jp/search/1')
      url.searchParams.set('app_id', appId)
      url.searchParams.set('app_key', appKey)
      url.searchParams.set('results_per_page', '20')
      url.searchParams.set('what', 'engineer')
      url.searchParams.set('where', 'Tokyo')

      adzunaJobsInFlight = (async () => {
        agentLog('H2', 'src/App.jsx:loadJobsOnce', 'fetch_start', {
          endpoint: 'https://api.adzuna.com/v1/api/jobs/jp/search/1',
          params: {
            results_per_page: '20',
            what: 'engineer',
            where: 'Tokyo',
          },
        })
        const res = await fetch(url.toString())
        agentLog('H2', 'src/App.jsx:loadJobsOnce', 'fetch_response', {
          ok: res.ok,
          status: res.status,
        })
        if (!res.ok) throw new Error(`Adzuna HTTP ${res.status}`)
        const data = await res.json()
        const results = Array.isArray(data?.results) ? data.results : []

        let invalid = 0
        const mapped = results
          .map((r, i) => ({
            id: String(r?.id ?? i + 1),
            title: r?.title ?? '',
            company: r?.company?.display_name ?? '',
            lat: Number(r?.latitude),
            lng: Number(r?.longitude),
          }))
          .filter((j) => {
            const ok =
              j.title &&
              j.company &&
              Number.isFinite(j.lat) &&
              Number.isFinite(j.lng)
            if (!ok) invalid += 1
            return ok
          })

        agentLog('H3', 'src/App.jsx:loadJobsOnce', 'mapped_summary', {
          resultsCount: results.length,
          mappedCount: mapped.length,
          invalidCount: invalid,
        })

        if (mapped.length === 0) return null
        adzunaJobsCached = mapped
        return mapped
      })()

      return adzunaJobsInFlight
    }

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
      lastOriginRef.current = origin

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

      const inRange = jobsRef.current.filter((j) => {
        const p = L.latLng(j.lat, j.lng)
        return origin.distanceTo(p) <= 10000
      })

      agentLog('H4', 'src/App.jsx:renderFromOrigin', 'render_jobs', {
        jobsTotal: jobsRef.current.length,
        inRange: inRange.length,
        origin: { lat: origin.lat, lng: origin.lng },
      })

      inRange.forEach((j) => {
        L.marker([j.lat, j.lng])
          .addTo(jobsLayer)
          .bindPopup(`<b>${escapeHtml(j.title)}</b><br/>${escapeHtml(j.company)}`)
      })
    }

    const onClick = (e) => renderFromOrigin(e.latlng)
    map.on('click', onClick)

    // 起動時に1回だけ求人を取得（失敗時は必ずダミーのまま）
    loadJobsOnce()
      .then((mapped) => {
        if (Array.isArray(mapped) && mapped.length > 0) {
          jobsRef.current = mapped
          agentLog('H2', 'src/App.jsx:loadJobsOnce', 'jobs_ref_set_from_api', {
            jobsTotal: jobsRef.current.length,
          })
          console.info(`[Adzuna] jobs loaded: ${mapped.length}`)
          if (lastOriginRef.current) renderFromOrigin(lastOriginRef.current)
        }
      })
      .catch((err) => {
        agentLog('H2', 'src/App.jsx:loadJobsOnce', 'fetch_failed_fallback_dummy', {
          name: err?.name,
          message: String(err?.message ?? err),
        })
        console.warn('[Adzuna] failed, fallback to dummy jobs.json', err)
      })

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
