import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthGate from '../components/AuthGate'

const API_URL = import.meta.env.VITE_API_URL || ''

interface EnvelopRow {
  id: number
  source_name: string
  type: string
  is_active: boolean
  last_balance: string | null
  target_amount: string | null
  balance_history: number[] | null
}

interface NwPoint {
  date: string
  net_worth: number
  transactions: { source_name: string; txn_name: string; amount: number; envelope_type: string }[]
}

// ─── Sparkline SVG ───────────────────────────────
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  if (!data || data.length < 2) return <span style={{ color: '#444', fontSize: '0.7rem' }}>No history</span>
  const w = 180, h = 52
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 8) - 4
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Net Worth Chart ──────────────────────────────
const NetWorthChart = ({ history, currentData }: { history: NwPoint[]; currentData: EnvelopRow[] }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: NwPoint } | null>(null)

  const sum = (types: string[]) => currentData.filter(e => types.includes(e.type)).reduce((s, e) => s + parseFloat(e.last_balance || '0'), 0)
  const accounts   = sum(['Account'])
  const expenses   = sum(['Expense'])
  const investment = sum(['Investment'])
  const savings    = sum(['Savings'])
  const goals      = sum(['Goal'])
  const lent       = sum(['Lent'])
  const owe        = sum(['Owe'])
  const netWorth   = accounts + expenses + investment + savings + goals + lent - owe

  const formulaRows = [
    { label: '🏦 Accounts',     value: accounts,   add: true  },
    { label: '💸 Expense Left', value: expenses,   add: true  },
    { label: '📊 Investment',   value: investment, add: true  },
    { label: '🏛️ Savings',     value: savings,    add: true  },
    { label: '🎯 Goals',       value: goals,      add: true  },
    { label: '🤝 Lent',        value: lent,       add: true  },
    { label: '💳 Owe',         value: owe,        add: false },
  ]

  //  ── Chart drawing ──────────────────────────────
  const W = 900, H = 220, PAD = { t: 20, r: 20, b: 36, l: 72 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  if (history.length === 0) {
    return (
      <div className="analytics-card analytics-hero">
        <div className="analytics-hero-label">Net Worth</div>
        <div className="analytics-hero-value" style={{ color: netWorth >= 0 ? '#4ade80' : '#f87171' }}>
          ₹{Math.abs(netWorth).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
        <p className="analytics-empty" style={{ marginTop: '12px' }}>Not enough transaction history to show a chart.</p>
        <div className="analytics-hero-formula" style={{ marginTop: '16px' }}>
          {formulaRows.map((r, i) => (
            <div key={i} className="analytics-formula-row">
              <span>{r.add ? '+' : '−'}</span>
              <span>{r.label}</span>
              <span style={{ color: r.add ? '#4ade80' : '#f87171', fontWeight: 700 }}>₹{r.value.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const values  = history.map(p => p.net_worth)
  const minVal  = Math.min(...values)
  const maxVal  = Math.max(...values)
  const range   = maxVal - minVal || 1

  const toX = (i: number) => PAD.l + (i / (history.length - 1)) * iW
  const toY = (v: number) => PAD.t + iH - ((v - minVal) / range) * iH

  const pts = history.map((p, i) => `${toX(i)},${toY(p.net_worth)}`).join(' ')
  const areaPath = `M${toX(0)},${toY(history[0].net_worth)} ${history.map((p, i) => `L${toX(i)},${toY(p.net_worth)}`).join(' ')} L${toX(history.length - 1)},${PAD.t + iH} L${toX(0)},${PAD.t + iH} Z`

  // Y-axis ticks
  const ticks = Array.from({ length: 5 }, (_, i) => minVal + (range / 4) * i)

  // X-axis date labels (show ~6 evenly spaced)
  const dateLabels = history.filter((_, i) => i % Math.ceil(history.length / 6) === 0 || i === history.length - 1)

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const scaleX = W / rect.width
    const mx = (e.clientX - rect.left) * scaleX
    const ix = (mx - PAD.l) / iW
    const idx = Math.round(ix * (history.length - 1))
    const clamped = Math.max(0, Math.min(history.length - 1, idx))
    const pt = history[clamped]
    const svgX = toX(clamped)
    const svgY = toY(pt.net_worth)
    // Convert SVG coords back to screen space
    const screenX = rect.left + (svgX / W) * rect.width
    const screenY = rect.top  + (svgY / H) * rect.height
    setTooltip({ x: screenX, y: screenY, point: pt })
  }

  const color = '#7c6ef7'

  return (
    <div className="analytics-card analytics-hero">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="analytics-hero-label">Net Worth · Last 90 Days</div>
          <div className="analytics-hero-value" style={{ color: netWorth >= 0 ? '#4ade80' : '#f87171' }}>
            ₹{Math.abs(netWorth).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            {netWorth < 0 && <span style={{ fontSize: '1rem', marginLeft: '8px', color: '#f87171' }}>deficit</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {formulaRows.map((r, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.label}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: r.add ? '#4ade80' : '#f87171' }}>{r.add ? '+' : '−'} ₹{r.value.toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', cursor: 'crosshair', display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id="nw-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {ticks.map((tick, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={toY(tick)} x2={W - PAD.r} y2={toY(tick)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              <text x={PAD.l - 6} y={toY(tick) + 4} textAnchor="end" fill="#555" fontSize={10}>
                {tick >= 1e6 ? `${(tick / 1e5).toFixed(0)}L` : tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
              </text>
            </g>
          ))}

          {/* X-axis dates */}
          {dateLabels.map((p, i) => {
            const idx2 = history.findIndex(h => h.date === p.date)
            return (
              <text key={i} x={toX(idx2)} y={H - 4} textAnchor="middle" fill="#555" fontSize={9}>
                {p.date.slice(5)}
              </text>
            )
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#nw-gradient)" />

          {/* Line */}
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Hover dot */}
          {tooltip && (() => {
            const idx2 = history.findIndex(h => h.date === tooltip.point.date)
            return idx2 >= 0 ? (
              <>
                <line x1={toX(idx2)} y1={PAD.t} x2={toX(idx2)} y2={PAD.t + iH} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
                <circle cx={toX(idx2)} cy={toY(tooltip.point.net_worth)} r={5} fill={color} stroke="#0f1117" strokeWidth={2} />
              </>
            ) : null
          })()}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div className="nw-tooltip" style={{ left: Math.min(tooltip.x, window.innerWidth - 280), top: tooltip.y - 8 }}>
            <div className="nw-tooltip-date">{tooltip.point.date}</div>
            <div className="nw-tooltip-nw">₹{tooltip.point.net_worth.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</div>
            <div className="nw-tooltip-divider" />
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
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Account Breakdown ───────────────────────────
const AccountBreakdown = ({ data }: { data: EnvelopRow[] }) => {
  const accounts = data.filter(e => e.type === 'Account')
  const max = Math.max(...accounts.map(e => parseFloat(e.last_balance || '0')), 1)

  return (
    <div className="analytics-card">
      <div className="analytics-section-title">🏦 Account Breakdown</div>
      <div className="analytics-bar-list">
        {accounts.map(e => {
          const val = parseFloat(e.last_balance || '0')
          const pct = (val / max) * 100
          return (
            <div key={e.id} className="analytics-bar-item">
              <div className="analytics-bar-meta">
                <span>{e.source_name}</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>₹{val.toLocaleString('en-IN')}</span>
              </div>
              <div className="analytics-bar-bg">
                <div className="analytics-bar-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }} />
              </div>
            </div>
          )
        })}
        {accounts.length === 0 && <p className="analytics-empty">No accounts found.</p>}
      </div>
    </div>
  )
}

// ─── Expense Health ───────────────────────────────
const ExpenseHealth = ({ data }: { data: EnvelopRow[] }) => {
  const expenses = data.filter(e => e.type === 'Expense')
  const totalLeft    = expenses.reduce((s, e) => s + parseFloat(e.last_balance || '0'), 0)
  const totalBudget  = expenses.reduce((s, e) => s + parseFloat(e.target_amount || '0'), 0)
  const usedBudget   = totalBudget - totalLeft
  const overallPct   = totalBudget > 0 ? Math.min((usedBudget / totalBudget) * 100, 100) : 0
  const overallColor = overallPct > 90 ? '#f87171' : overallPct > 70 ? '#fbbf24' : '#4ade80'

  return (
    <div className="analytics-card">
      <div className="analytics-section-title">💸 Expense Health</div>

      <div className="analytics-summary-pill" style={{ background: `rgba(${overallPct > 90 ? '248,113,113' : overallPct > 70 ? '251,191,36' : '74,222,128'},0.1)`, border: `1px solid ${overallColor}30` }}>
        <span style={{ color: overallColor, fontWeight: 800, fontSize: '1.5rem' }}>{overallPct.toFixed(1)}%</span>
        <span style={{ color: '#888', fontSize: '0.8rem' }}>Budget Used  (₹{usedBudget.toLocaleString('en-IN')} / ₹{totalBudget.toLocaleString('en-IN')})</span>
      </div>

      <div className="analytics-bar-list" style={{ marginTop: '20px' }}>
        {expenses.map(e => {
          const left   = parseFloat(e.last_balance || '0')
          const budget = parseFloat(e.target_amount || '0')
          const used   = budget > 0 ? budget - left : 0
          const pct    = budget > 0 ? Math.min((used / budget) * 100, 100) : 0
          const color  = pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#4ade80'
          return (
            <div key={e.id} className="analytics-bar-item">
              <div className="analytics-bar-meta">
                <span>{e.source_name}</span>
                <span style={{ fontSize: '0.78rem', color: '#888' }}>
                  ₹{left.toLocaleString('en-IN')} left {budget > 0 && `of ₹${budget.toLocaleString('en-IN')}`}
                </span>
              </div>
              <div className="analytics-bar-bg">
                <div className="analytics-bar-fill" style={{ width: `${pct}%`, background: color, opacity: 0.85 }} />
              </div>
              {pct > 0 && <span style={{ color, fontSize: '0.72rem', fontWeight: 700 }}>{pct.toFixed(0)}% used</span>}
            </div>
          )
        })}
        {expenses.length === 0 && <p className="analytics-empty">No expense envelopes found.</p>}
      </div>
    </div>
  )
}

// ─── Goal Progress ────────────────────────────────
const GoalProgress = ({ data }: { data: EnvelopRow[] }) => {
  const goals = data.filter(e => e.type === 'Goal')

  return (
    <div className="analytics-card">
      <div className="analytics-section-title">🎯 Goal Progress</div>
      <div className="analytics-goals-grid">
        {goals.map(e => {
          const achieved = parseFloat(e.last_balance || '0')
          const target   = parseFloat(e.target_amount || '0')
          const pct      = target > 0 ? Math.min((achieved / target) * 100, 100) : 0
          const r = 32, circ = 2 * Math.PI * r
          const fill = circ - (pct / 100) * circ
          const color = pct >= 100 ? '#4ade80' : pct > 60 ? '#c084fc' : '#7c6ef7'
          return (
            <div key={e.id} className="analytics-goal-card">
              <svg width={80} height={80}>
                <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
                <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7}
                  strokeDasharray={circ} strokeDashoffset={fill}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
                <text x={40} y={45} textAnchor="middle" fill={color} fontSize={12} fontWeight={800}>{pct.toFixed(0)}%</text>
              </svg>
              <div className="analytics-goal-name">{e.source_name}</div>
              <div className="analytics-goal-amounts">
                <span style={{ color }}>₹{achieved.toLocaleString('en-IN')}</span>
                <span style={{ color: '#555' }}> / </span>
                <span style={{ color: '#888' }}>₹{target.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )
        })}
        {goals.length === 0 && <p className="analytics-empty">No goals set.</p>}
      </div>
    </div>
  )
}

// ─── Activity Trend ───────────────────────────────
const ActivityTrend = ({ data }: { data: EnvelopRow[] }) => {
  const KEY_TYPES = ['Account', 'Expense', 'Savings', 'Investment']
  const TYPE_COLORS: Record<string, string> = {
    Account: '#38bdf8', Expense: '#f87171', Savings: '#7c6ef7', Investment: '#fbbf24', Goal: '#c084fc', Lent: '#fb923c', Owe: '#f43f5e'
  }
  const cards = data.filter(e => KEY_TYPES.includes(e.type) && e.balance_history && e.balance_history.length > 1)

  return (
    <div className="analytics-card">
      <div className="analytics-section-title">📈 Activity Trend</div>
      <div className="analytics-trends-grid">
        {cards.map(e => {
          const color = TYPE_COLORS[e.type] ?? '#8888a8'
          const hist  = e.balance_history!
          const last  = hist[hist.length - 1]
          const prev  = hist[hist.length - 2]
          const delta = last - prev
          return (
            <div key={e.id} className="analytics-trend-card">
              <div className="analytics-trend-header">
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{e.source_name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{e.type}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color, fontSize: '0.92rem' }}>₹{last.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '0.72rem', color: delta >= 0 ? '#4ade80' : '#f87171' }}>
                    {delta >= 0 ? '▲' : '▼'} ₹{Math.abs(delta).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
              <Sparkline data={hist} color={color} />
            </div>
          )
        })}
        {cards.length === 0 && <p className="analytics-empty">Not enough transaction history to show trends.</p>}
      </div>
    </div>
  )
}

// ─── Lent & Owe Summary ───────────────────────────
const LentOweSummary = ({ data }: { data: EnvelopRow[] }) => {
  const lentCards = data.filter(e => e.type === 'Lent')
  const oweCards  = data.filter(e => e.type === 'Owe')
  const totalLent = lentCards.reduce((s, e) => s + parseFloat(e.last_balance || '0'), 0)
  const totalOwe  = oweCards.reduce((s,  e) => s + parseFloat(e.last_balance || '0'), 0)

  return (
    <div className="analytics-card">
      <div className="analytics-section-title">🤝 Lent &amp; Owe</div>
      <div className="analytics-lent-row">
        <div className="analytics-lent-half" style={{ borderColor: 'rgba(251,146,60,0.3)' }}>
          <div className="analytics-lent-title" style={{ color: '#fb923c' }}>🤝 Total Lent Out</div>
          <div className="analytics-lent-total" style={{ color: '#fb923c' }}>₹{totalLent.toLocaleString('en-IN')}</div>
          {lentCards.map(e => (
            <div key={e.id} className="analytics-lent-item">
              <span>{e.source_name}</span>
              <span style={{ color: '#fb923c', fontWeight: 700 }}>₹{parseFloat(e.last_balance || '0').toLocaleString('en-IN')}</span>
            </div>
          ))}
          {lentCards.length === 0 && <p className="analytics-empty">Nothing lent out.</p>}
        </div>

        <div className="analytics-lent-half" style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
          <div className="analytics-lent-title" style={{ color: '#f43f5e' }}>💳 Total You Owe</div>
          <div className="analytics-lent-total" style={{ color: '#f43f5e' }}>₹{totalOwe.toLocaleString('en-IN')}</div>
          {oweCards.map(e => (
            <div key={e.id} className="analytics-lent-item">
              <span>{e.source_name}</span>
              <span style={{ color: '#f43f5e', fontWeight: 700 }}>₹{parseFloat(e.last_balance || '0').toLocaleString('en-IN')}</span>
            </div>
          ))}
          {oweCards.length === 0 && <p className="analytics-empty">You owe nothing.</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Analytics Page ───────────────────────────────
const Analytics = () => {
  const navigate = useNavigate()
  const [data, setData]       = useState<EnvelopRow[]>([])
  const [nwHistory, setNwHistory] = useState<NwPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, nwRes] = await Promise.all([
          fetch(`${API_URL}/api/dashboard`),
          fetch(`${API_URL}/api/networth`),
        ])
        const dashBody = await dashRes.json()
        const nwBody   = await nwRes.json()
        if (!dashRes.ok) throw new Error(dashBody.error || 'Failed to load dashboard')
        setData(dashBody.data || [])
        setNwHistory(nwBody.data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AuthGate>
      <div className="settings-page">
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="logo-icon">📊</div>
            Analytics
          </div>
          <div className="navbar-actions">
            <button id="analytics-back-btn" className="icon-btn" title="Dashboard" onClick={() => navigate('/')}>🏠</button>
          </div>
        </nav>

        <div className="page" style={{ maxWidth: '1100px' }}>
          {loading && <p className="loading-text">Loading analytics…</p>}
          {error   && <p className="error-text">⚠️ {error}</p>}
          {!loading && !error && (
            <div className="analytics-grid">
              <NetWorthChart history={nwHistory} currentData={data} />
              <AccountBreakdown data={data} />
              <ExpenseHealth  data={data} />
              <GoalProgress   data={data} />
              <ActivityTrend  data={data} />
              <LentOweSummary data={data} />
            </div>
          )}
        </div>
      </div>
    </AuthGate>
  )
}

export default Analytics
