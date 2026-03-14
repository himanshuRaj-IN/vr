import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthGate from '../components/AuthGate'

const API_URL = import.meta.env.VITE_API_URL || ''

// ─── Types ────────────────────────────────────────
interface EnvelopRow {
  id: number; source_name: string; type: string; is_active: boolean
  last_balance: string | null; target_amount: string | null; balance_history: number[] | null
}

interface NwPoint {
  date: string
  by_type: Record<string, number>   // { Account: 1000, Expense: 200, ... }
  transactions: { source_name: string; txn_name: string; amount: number; envelope_type: string }[]
}

// ─── Constants ────────────────────────────────────
const TYPE_META: Record<string, { icon: string; color: string; sign: 1 | -1 }> = {
  Account:    { icon: '🏦', color: '#38bdf8', sign:  1 },
  Expense:    { icon: '💸', color: '#f87171', sign:  1 },
  Investment: { icon: '📊', color: '#fbbf24', sign:  1 },
  Savings:    { icon: '🏛️', color: '#7c6ef7', sign:  1 },
  Goal:       { icon: '🎯', color: '#c084fc', sign:  1 },
  Lent:       { icon: '🤝', color: '#fb923c', sign:  1 },
  Owe:        { icon: '💳', color: '#f43f5e', sign: -1 },
}

const TIME_RANGES = [
  { label: '7D',  days: 7  },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: 0  },
]

// ─── Compute net worth from a point given active types ─
const computeNw = (point: NwPoint, activeTypes: Set<string>) => {
  let nw = 0
  for (const [type, val] of Object.entries(point.by_type)) {
    const meta = TYPE_META[type]
    if (!meta) continue
    if (type === 'Owe') { nw -= val; continue } // always subtract owe
    if (activeTypes.has(type)) nw += val
  }
  return nw
}

// ─── Net Worth Chart ──────────────────────────────
const NetWorthChart = ({
  allHistory,
  currentData,
}: {
  allHistory: NwPoint[]
  currentData: EnvelopRow[]
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip]       = useState<{ x: number; y: number; point: NwPoint; nw: number } | null>(null)
  const [rangeDays, setRangeDays]   = useState(90)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(['Account', 'Expense', 'Investment', 'Savings', 'Goal', 'Lent'])
  )

  // Filter history by selected time range
  const history = (() => {
    if (rangeDays === 0) return allHistory
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - rangeDays)
    const cutStr = cutoff.toISOString().slice(0, 10)
    return allHistory.filter(p => p.date >= cutStr)
  })()

  // Current net worth from latest day's by_type
  const latestPoint = allHistory[allHistory.length - 1]
  const currentNw   = latestPoint ? computeNw(latestPoint, activeTypes) : (() => {
    const sum = (types: string[]) => currentData.filter(e => types.includes(e.type)).reduce((s, e) => s + parseFloat(e.last_balance || '0'), 0)
    return sum(Array.from(activeTypes)) - sum(['Owe'])
  })()

  const toggleType = (type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // ── SVG Chart ────────────────────────────────────
  const W = 1000, H = 260, PAD = { t: 24, r: 24, b: 40, l: 80 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  const values  = history.map(p => computeNw(p, activeTypes))
  const minVal  = values.length ? Math.min(...values) : 0
  const maxVal  = values.length ? Math.max(...values) : 1
  const range   = maxVal - minVal || 1

  const toX = (i: number) => PAD.l + (i / Math.max(history.length - 1, 1)) * iW
  const toY = (v: number) => PAD.t + iH - ((v - minVal) / range) * iH

  const pts      = history.map((_, i) => `${toX(i)},${toY(values[i])}`).join(' ')
  const areaPath = history.length < 2 ? '' :
    `M${toX(0)},${toY(values[0])} ${history.map((_, i) => `L${toX(i)},${toY(values[i])}`).join(' ')} L${toX(history.length-1)},${PAD.t+iH} L${toX(0)},${PAD.t+iH} Z`

  const ticks = Array.from({ length: 5 }, (_, i) => minVal + (range / 4) * i)
  const fmtY  = (v: number) => v >= 1e5 ? `${(v/1e5).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)

  const dateStep = Math.max(1, Math.ceil(history.length / 7))
  const dateLabels = history.filter((_, i) => i % dateStep === 0 || i === history.length - 1)

  const lineColor = currentNw >= 0 ? '#7c6ef7' : '#f87171'

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || history.length === 0) return
    const rect  = svg.getBoundingClientRect()
    const mx    = (e.clientX - rect.left) * (W / rect.width)
    const ix    = (mx - PAD.l) / iW
    const idx   = Math.round(Math.max(0, Math.min(history.length - 1, ix * (history.length - 1))))
    const pt    = history[idx]
    const nw    = values[idx]
    const svgX  = toX(idx)
    const svgY  = toY(nw)
    setTooltip({
      x: rect.left + (svgX / W) * rect.width,
      y: rect.top  + (svgY / H) * rect.height,
      point: pt,
      nw,
    })
  }, [history, values]) // eslint-disable-line

  return (
    <div className="analytics-card analytics-hero" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>

      {/* ── Top bar: Current NW + controls ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>

        {/* Left: current value */}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#555', marginBottom: '4px' }}>
            NET WORTH
          </div>
          <div style={{ fontSize: '2.6rem', fontWeight: 900, letterSpacing: '-2px', color: currentNw >= 0 ? '#4ade80' : '#f87171', lineHeight: 1 }}>
            ₹{Math.abs(currentNw).toLocaleString('en-IN')}
            {currentNw < 0 && <span style={{ fontSize: '1rem', marginLeft: '8px' }}>deficit</span>}
          </div>
        </div>

        {/* Right: time range + type toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>

          {/* Time range pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {TIME_RANGES.map(r => (
              <button
                key={r.label}
                onClick={() => setRangeDays(r.days)}
                style={{
                  padding: '5px 14px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 700,
                  background: rangeDays === r.days ? '#7c6ef7' : 'rgba(255,255,255,0.06)',
                  color: rangeDays === r.days ? '#fff' : '#666',
                  transition: 'all 0.15s',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Type toggles */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {Object.entries(TYPE_META).filter(([t]) => t !== 'Owe').map(([type, meta]) => {
              const on = activeTypes.has(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  style={{
                    padding: '4px 12px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700,
                    border: `1px solid ${on ? meta.color : 'rgba(255,255,255,0.1)'}`,
                    background: on ? `${meta.color}18` : 'transparent',
                    color: on ? meta.color : '#444',
                    transition: 'all 0.15s',
                  }}
                >
                  {meta.icon} {type}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Chart ── */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {history.length < 2 ? (
          <p style={{ color: '#444', fontStyle: 'italic', fontSize: '0.85rem', margin: 'auto' }}>
            Not enough data for the selected range.
          </p>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', flex: 1, cursor: 'crosshair', display: 'block' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          >
            <defs>
              <linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={lineColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grid lines + Y labels */}
            {ticks.map((tick, i) => (
              <g key={i}>
                <line x1={PAD.l} y1={toY(tick)} x2={W - PAD.r} y2={toY(tick)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                <text x={PAD.l - 8} y={toY(tick) + 4} textAnchor="end" fill="#444" fontSize={11}>{fmtY(tick)}</text>
              </g>
            ))}

            {/* X date labels */}
            {dateLabels.map((p, i) => {
              const idx = history.findIndex(h => h.date === p.date)
              return (
                <text key={i} x={toX(idx)} y={H - 6} textAnchor="middle" fill="#444" fontSize={10}>
                  {p.date.slice(5)}
                </text>
              )
            })}

            {/* Zero line if needed */}
            {minVal < 0 && maxVal > 0 && (
              <line x1={PAD.l} y1={toY(0)} x2={W - PAD.r} y2={toY(0)} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4 3" />
            )}

            {/* Area */}
            <path d={areaPath} fill="url(#nw-grad)" />

            {/* Line */}
            <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Hover crosshair + dot */}
            {tooltip && (() => {
              const idx = history.findIndex(h => h.date === tooltip.point.date)
              return idx >= 0 ? (
                <>
                  <line x1={toX(idx)} y1={PAD.t} x2={toX(idx)} y2={PAD.t + iH} stroke={lineColor} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
                  <circle cx={toX(idx)} cy={toY(tooltip.nw)} r={5} fill={lineColor} stroke="#0f1117" strokeWidth={2.5} />
                </>
              ) : null
            })()}
          </svg>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div className="nw-tooltip" style={{ left: Math.min(tooltip.x, window.innerWidth - 290), top: tooltip.y - 10 }}>
            <div className="nw-tooltip-date">{tooltip.point.date}</div>
            <div className="nw-tooltip-nw">₹{tooltip.nw.toLocaleString('en-IN')}</div>

            {/* Per-type breakdown on this day */}
            {Object.entries(tooltip.point.by_type).map(([type, val]) => {
              const meta = TYPE_META[type]
              if (!meta) return null
              const included = type === 'Owe' || activeTypes.has(type)
              if (!included) return null
              return (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '2px 0', color: '#666' }}>
                  <span>{meta.icon} {type}</span>
                  <span style={{ color: meta.color, fontWeight: 700 }}>
                    {type === 'Owe' ? '−' : '+'} ₹{val.toLocaleString('en-IN')}
                  </span>
                </div>
              )
            })}

            {tooltip.point.transactions.length > 0 && (
              <>
                <div className="nw-tooltip-divider" />
                <div style={{ fontSize: '0.65rem', color: '#444', marginBottom: '4px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transactions</div>
                {tooltip.point.transactions.map((t, i) => (
                  <div key={i} className="nw-tooltip-txn">
                    <div>
                      <span className="nw-tooltip-name">{t.txn_name || t.source_name}</span>
                      <span className="nw-tooltip-tag"> · {t.source_name}</span>
                    </div>
                    <span style={{ color: t.amount >= 0 ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {t.amount >= 0 ? '+' : ''}₹{Math.abs(t.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Analytics Page ───────────────────────────────
const Analytics = () => {
  const navigate = useNavigate()
  const [currentData, setCurrentData]  = useState<EnvelopRow[]>([])
  const [nwHistory, setNwHistory]      = useState<NwPoint[]>([])
  const [loading, setLoading]          = useState(true)
  const [error, setError]              = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const dashRes  = await fetch(`${API_URL}/api/dashboard`)
        const dashBody = await dashRes.json()
        if (!dashRes.ok) throw new Error(dashBody.error || 'Failed to load')
        setCurrentData(dashBody.data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }

      try {
        // Fetch all-time history — frontend slices it by selected range
        const nwRes  = await fetch(`${API_URL}/api/networth?days=0`)
        const nwBody = await nwRes.json()
        if (nwRes.ok) setNwHistory(nwBody.data || [])
      } catch (e) {
        console.warn('Net worth history unavailable:', e)
      }
    }
    load()
  }, [])

  return (
    <AuthGate>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="logo-icon">📊</div>
            Analytics
          </div>
          <div className="navbar-actions">
            <button id="analytics-back-btn" className="icon-btn" title="Dashboard" onClick={() => navigate('/')}>🏠</button>
          </div>
        </nav>

        <div style={{ flex: 1, padding: '20px 28px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading && <p className="loading-text">Loading analytics…</p>}
          {error   && <p className="error-text">⚠️ {error}</p>}
          {!loading && !error && (
            <NetWorthChart allHistory={nwHistory} currentData={currentData} />
          )}
        </div>
      </div>
    </AuthGate>
  )
}

export default Analytics
