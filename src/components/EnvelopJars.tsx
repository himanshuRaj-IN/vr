import { useState, useEffect } from 'react'
import TransactionModal from './TransactionModal'
import AccountDepositModal from './AccountDepositModal'
import { Landmark, CreditCard, PiggyBank, TrendingUp, BarChart3, Handshake, Target, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || ''

// ─── Types ────────────────────────────────────────────────────────────────────
interface EnvelopRow {
  id: number
  source_name: string
  type: string
  timeframe: number | null
  target_amount: string | null
  target_date: string | null
  last_balance: string | null
  last_date: string | null
  topup_total: string | null
  expense_total: string | null
  balance_history: (string | number)[] | null
  people_balances?: { name: string; pending: number }[]
}
interface Account { id: number; source_name: string }
interface ModalState { mode: 'topup' | 'expense'; sourceName: string; targetType: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: string | null | number) =>
  v != null ? `₹ ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : null

const spendRate = (topup: string | null, expense: string | null): number | null => {
  const t = parseFloat(topup ?? '0')
  const e = parseFloat(expense ?? '0')
  if (!topup || t === 0) return null
  return Math.min(Math.round((e / t) * 100), 999)
}

const rateColor = (pct: number) => {
  if (pct < 50) return '#4ade80'
  if (pct < 80) return '#fbbf24'
  if (pct < 100) return '#fb923c'
  return '#FF2D55'
}

const Sparkline = ({ data, color }: { data: (string | number)[]; color: string }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!data || data.length < 2) return <div style={{ height: '60px' }} />

  const values = data.map(v => parseFloat(v as string))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = (max - min) || 1

  const width = 260
  const height = 60
  const padding = 10

  const calculatedPoints = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - padding * 2) - padding
    return { x, y, val: v }
  })

  const pointsString = calculatedPoints.map(p => `${p.x},${p.y}`).join(' ')
  const lastPoint = calculatedPoints[calculatedPoints.length - 1]

  return (
    <div
      style={{ position: 'relative', width: '100%', height: `${height}px`, marginTop: '14px', marginBottom: '8px' }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div style={{
          position: 'absolute',
          top: '-28px',
          left: `${(calculatedPoints[hoveredIndex].x / width) * 100}%`,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.9)',
          color: '#fff',
          padding: '3px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 'bold',
          pointerEvents: 'none',
          zIndex: 100,
          whiteSpace: 'nowrap',
          border: `1px solid ${color}60`,
          boxShadow: `0 4px 12px rgba(0,0,0,0.5), 0 0 8px ${color}30`,
          backdropFilter: 'blur(6px)'
        }}>
          ₹{calculatedPoints[hoveredIndex].val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsString}
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />

        {/* Pulsing end point */}
        <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill={color}>
          <animate attributeName="r" from="4" to="10" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.8" to="0" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill={color} stroke="#fff" strokeWidth="1" />

        {/* Hover Points - Invisible but large hit areas */}
        {calculatedPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="15"
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* Highlight dot on hover */}
        {hoveredIndex !== null && (
          <circle
            cx={calculatedPoints[hoveredIndex].x}
            cy={calculatedPoints[hoveredIndex].y}
            r="6"
            fill="#fff"
            stroke={color}
            strokeWidth="3"
            pointerEvents="none"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        )}
      </svg>
    </div>
  )
}

// ─── Action buttons (shared) ──────────────────────────────────────────────────
const ActionBtns = ({
  env, onTopup, onExpense
}: { env: EnvelopRow; onTopup: () => void; onExpense: () => void }) => {
  const isInvest = env.type.toLowerCase().includes('investment')
  const isIconOnly = env.type === 'Savings' || env.type === 'Goal' || env.type === 'Lent' || env.type === 'Owe' || isInvest

  let topupLabel = 'Top Up'
  let expenseLabel = 'Spend'

  if (env.type === 'Savings' || env.type === 'Goal') {
    topupLabel = 'Commit'
    expenseLabel = 'Withdraw'
  } else if (env.type === 'Lent') {
    topupLabel = 'Lent'
    expenseLabel = 'Get Back'
  } else if (env.type === 'Owe') {
    topupLabel = 'Pay Back'
    expenseLabel = 'Borrow More'
  }

  if (isIconOnly) {
    const TYPE_COLORS: Record<string, string> = {
      Goal: '#c084fc',
      Savings: '#7c6ef7',
      Lent: '#fb923c',
      Owe: '#f43f5e'
    }
    const accentColor = TYPE_COLORS[env.type] || '#8888a8'
    const accentBg = `${accentColor}4D` // ~30% opacity

    return (
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button id={`topup-${env.id}`} className="xp-icon-btn" onClick={onTopup} title={topupLabel} style={{ borderColor: accentBg, color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowDownCircle size={18} /></button>
          <button id={`expense-${env.id}`} className="xp-icon-btn" onClick={onExpense} title={expenseLabel} style={{ borderColor: 'rgba(244,63,94,0.3)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowUpCircle size={18} /></button>
        </div>
        {env.timeframe
          ? <span className="xp-timeframe">{env.timeframe} Days</span>
          : null
        }
      </div>
    )
  }

  return (
    <div className="card-actions">
      <button id={`topup-${env.id}`} className="card-action-btn topup" onClick={onTopup} title={topupLabel}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><ArrowDownCircle size={16} /> {topupLabel}</div>
      </button>
      <button id={`expense-${env.id}`} className="card-action-btn expense" onClick={onExpense} title={expenseLabel}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><ArrowUpCircle size={16} /> {expenseLabel}</div>
      </button>
    </div>
  )
}

// ─── ACCOUNT CARD ─────────────────────────────────────────────────────────────
// ─── ACCOUNT CARD ─────────────────────────────────────────────────────
const AccountCard = ({ env, onDeposit, onTopup, visible }: { env: EnvelopRow; onDeposit: () => void; onTopup: () => void; visible: boolean }) => (
  <div className="env-card env-account">
    <div className="env-account-left">
      <div className="env-card-icon"><Landmark size={24} /></div>
      <div>
        <div className="env-card-name">{env.source_name}</div>
        <div className="env-card-tag">Bank Account</div>
      </div>
    </div>
    <div className="env-account-right">
      <div className="env-account-balance">{visible ? fmt(env.last_balance) : '••••••'}</div>
      {fmtDate(env.last_date) && <div className="env-card-date">Updated {fmtDate(env.last_date)}</div>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', width: '100%' }}>
        <button id={`acc-transfer-${env.id}`} onClick={onTopup}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
          <ArrowLeftRight size={14} /> Transfer
        </button>
        <button id={`acc-deposit-${env.id}`} onClick={onDeposit}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
          <ArrowDownCircle size={14} /> Credit
        </button>
      </div>
    </div>
  </div>
)

// ─── EXPENSE CARD (Green top, Red bottom linear fill + Inline Form) ───────────
const ExpenseCard = ({
  env, onTopup, onTransactionDone, visible
}: { env: EnvelopRow; onTopup: () => void; onTransactionDone: () => void; visible: boolean }) => {
  const [isAdding, setIsAdding] = useState(false)
  const [amt, setAmt] = useState('')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sliderVal, setSliderVal] = useState(0)

  const handleSlideEnd = () => {
    if (sliderVal >= 90) {
      setSliderVal(0)
      doSubmit()
    } else {
      setSliderVal(0)
    }
  }

  // Use envelop ID to generate unique delay and duration so they don't move in sync
  const floatDelay = `-${(env.id % 20) * 1.5}s`
  const floatDuration = `${7 + (env.id % 5)}s`

  const rate = spendRate(env.topup_total, env.expense_total)
  const fillPct = rate != null ? Math.min(rate, 100) : 0
  const dynamicColor = rate != null ? rateColor(rate) : 'var(--muted)'

  const handleBlur = (e: React.FocusEvent) => {
    // Revert if clicked outside the form and form is empty
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (!amt && !desc) {
        setIsAdding(false)
        setError(null)
      }
    }
  }

  const doSubmit = async () => {
    const parsedAmt = parseFloat(amt)
    if (isNaN(parsedAmt) || parsedAmt <= 0) return setError('Invalid amount')

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_name: env.source_name,
          amount: parsedAmt,
          name: desc || 'Expense',
          transaction_date: date
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to record expense')
      setAmt('')
      setDesc('')
      setDate(new Date().toISOString().split('T')[0])
      setIsAdding(false)
      onTransactionDone()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSubmit()
  }

  const barColor = fillPct > 85 ? '#FF2D55' : fillPct > 60 ? '#fb923c' : '#4ade80'

  return (
    <div className="xp-card" style={{ position: 'relative' }}>
      {/* Slim 3px progress bar at bottom edge */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '0 0 var(--radius) var(--radius)', overflow: 'hidden', zIndex: 2 }}>
        <div style={{ height: '100%', width: `${Math.min(fillPct, 100)}%`, background: barColor, borderRadius: '0 0 0 var(--radius)', transition: 'width 0.6s ease, background 0.4s ease', boxShadow: `0 0 6px ${barColor}80` }} />
      </div>

      {/* Content layer */}
      <div className="xp-content">
        {/* Top row: name left · balance right */}
        <div className="xp-top">
          <span className="xp-name">{env.source_name}</span>
          <span className="xp-balance">{visible ? fmt(env.last_balance) : '••••••'}</span>
        </div>

        {/* Mid: Central Spend Button or Inline Form */}
        <div className="xp-mid" style={{ justifyContent: 'center', flex: 1, alignItems: 'center' }}>
          {!isAdding ? (
            <button
              className="xp-center-btn"
              onClick={() => setIsAdding(true)}
              title="Add Expense"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Expense
            </button>
          ) : (
            <form
              className="xp-inline-form"
              onBlur={handleBlur}
              onSubmit={handleSubmit}
            >
              {error && <div className="xp-inline-error">{error}</div>}
              <div className="xp-inline-inputs">
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Amount ₹"
                    value={amt}
                    onChange={e => setAmt(e.target.value)}
                    autoFocus
                    required
                    style={{ flex: 1 }}
                  />
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    style={{ flex: 1, padding: '7px', fontSize: '0.8rem' }}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="xp-inline-actions">
                <button type="button" className="xp-inline-cancel" title="Cancel" onClick={() => { setIsAdding(false); setError(null); setSliderVal(0); }}>✕</button>
                <button type="submit" className="xp-inline-submit desktop-only-btn" title="Save" disabled={saving}>
                  {saving ? '⏳' : '✓'}
                </button>
                <div className="mobile-only-slider-container">
                  <span className="slider-hint">{saving ? 'Saving...' : 'Slide to add ➔'}</span>
                  <input
                    type="range"
                    min="0" max="100"
                    value={sliderVal}
                    onChange={e => setSliderVal(parseInt(e.target.value))}
                    onMouseUp={handleSlideEnd}
                    onTouchEnd={handleSlideEnd}
                    disabled={saving}
                    className="xp-confirm-slider"
                  />
                  {/* Dynamic red fill tracking the slider value */}
                  <div
                    style={{ position: 'absolute', height: '100%', left: 0, top: 0, background: '#FF2D55', borderRadius: '18px', width: `calc(${sliderVal}% + 18px)`, pointerEvents: 'none', transition: 'width 0.1s', zIndex: 1, opacity: 0.2 }}
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Bottom row: % left · timeframe & topup right */}
        <div className="xp-bottom">
          {rate != null
            ? <span className="xp-pct" style={{ color: dynamicColor }}>{rate}%</span>
            : <span className="xp-pct xp-pct-muted">—%</span>
          }
          <div className="xp-bottom-right">
            {env.timeframe
              ? <span className="xp-timeframe">{env.timeframe}d</span>
              : <span className="xp-timeframe xp-pct-muted">no window set</span>
            }
            <button id={`topup-${env.id}`} className="xp-icon-btn" onClick={onTopup} title="Top Up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowDownCircle size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DEFAULT CARD (Income / Investment / Goal / etc.) ───────────────────────
const DefaultCard = ({
  env, onTopup, onExpense, visible
}: { env: EnvelopRow; onTopup: () => void; onExpense: () => void; visible: boolean }) => {
  const META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    Income: { icon: <TrendingUp size={24} />, color: '#4ade80', bg: 'rgba(74,222,128,0.07)' },
    Investment: { icon: <BarChart3 size={24} />, color: '#fbbf24', bg: 'rgba(251,191,36,0.07)' },
    Lent: { icon: <Handshake size={24} />, color: '#fb923c', bg: 'rgba(251,146,60,0.07)' },
    Owe: { icon: <CreditCard size={24} />, color: '#f43f5e', bg: 'rgba(244,63,94,0.07)' },
    Goal: { icon: <Target size={24} />, color: '#c084fc', bg: 'rgba(192,132,252,0.07)' },
  }
  const isInvest = env.type.toLowerCase().includes('investment');
  const actualTypeKey = isInvest ? 'Investment' : env.type;
  const m = META[actualTypeKey] ?? { icon: <CreditCard size={24} />, color: '#8888a8', bg: 'rgba(136,136,168,0.07)' }

  const isBelowTarget = env.target_amount && parseFloat(env.last_balance || '0') < parseFloat(env.target_amount);
  const balColor = isBelowTarget ? '#FF2D55' : m.color;
  const displayType = env.type;

  return (
    <div className="env-card env-default" style={{ borderColor: isBelowTarget ? '#FF2D5540' : (m.color + '40'), background: isBelowTarget ? 'rgba(255,45,85,0.05)' : m.bg, padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: isBelowTarget ? '#FF2D55' : m.color }}>{m.icon}</div>
          <div>
            <div className="env-card-name" style={{ margin: 0 }}>{env.source_name}</div>
            <div className="env-card-tag" style={{ color: isBelowTarget ? '#FF2D55' : m.color, background: isBelowTarget ? 'rgba(255,45,85,0.1)' : (m.color + '20'), display: 'inline-block', marginTop: '4px' }}>{displayType}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div className="env-default-balance" style={{ color: balColor, margin: 0 }}>
            {visible ? fmt(env.last_balance) : '••••••'}
          </div>
          {env.target_amount && (
            <div style={{ fontSize: '0.65rem', color: balColor, fontWeight: 'bold' }}>
              Target: {visible ? fmt(env.target_amount) : '••••'}
            </div>
          )}
        </div>
      </div>
      
      <ActionBtns env={env} onTopup={onTopup} onExpense={onExpense} />
    </div>
  )
}

// InvestmentCard removed in favor of DefaultCard


// ─── JAR CARD WRAPPER (handles modals per card) ───────────────────────────────
const EnvelopCard = ({ env, allEnvelops, onTransactionDone, visible }: {
  env: EnvelopRow; allEnvelops: EnvelopRow[]; onTransactionDone: () => void; visible: boolean
}) => {
  const [modal, setModal] = useState<ModalState | null>(null)
  const [showDeposit, setShowDeposit] = useState(false)

  const onTopup = () => setModal({ mode: 'topup', sourceName: env.source_name, targetType: env.type })
  const onExpense = () => setModal({ mode: 'expense', sourceName: env.source_name, targetType: env.type })
  const onDeposit = () => setShowDeposit(true)
  const done = () => { setModal(null); setShowDeposit(false); onTransactionDone() }

  // Exclude the current envelop from the transfer dropdown
  const otherEnvelops = allEnvelops.filter(e => e.source_name !== env.source_name)

  return (
    <>
      {env.type === 'Account' && <AccountCard env={env} onDeposit={onDeposit} onTopup={onTopup} visible={visible} />}
      {env.type === 'Expense' && <ExpenseCard env={env} onTopup={onTopup} onTransactionDone={done} visible={visible} />}
      {(env.type === 'Income' || env.type === 'Savings' || env.type.toLowerCase().includes('investment') || env.type === 'Lent' || env.type === 'Owe' || env.type === 'Goal') &&
        <DefaultCard env={env} onTopup={onTopup} onExpense={onExpense} visible={visible} />}

      {modal && (
        <TransactionModal mode={modal.mode} sourceName={modal.sourceName} targetType={modal.targetType}
          accounts={otherEnvelops} onClose={() => setModal(null)} onSuccess={done} />
      )}
      {showDeposit && (
        <AccountDepositModal sourceName={env.source_name}
          onClose={() => setShowDeposit(false)} onSuccess={done} />
      )}
    </>
  )
}

// ─── TYPE GRID CONFIG ─────────────────────────────────────────────────────────
const GRID_CLASS: Record<string, string> = {
  Account: 'jars-grid-account',
  Expense: 'jars-grid-expense',
  Savings: 'jars-grid-savings',
  Income: 'jars-grid-default',
  Investment: 'jars-grid-default',
  Lent: 'jars-grid-savings',
  Owe: 'jars-grid-savings',
  Goal: 'jars-grid-savings',
}

const TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
  Account: { icon: <Landmark size={24} />, color: '#38bdf8' },
  Expense: { icon: <ArrowUpCircle size={24} />, color: '#FF2D55' },
  Savings: { icon: <PiggyBank size={24} />, color: '#7c6ef7' },
  Income: { icon: <TrendingUp size={24} />, color: '#4ade80' },
  Investment: { icon: <BarChart3 size={24} />, color: '#fbbf24' },
  Lent: { icon: <Handshake size={24} />, color: '#fb923c' },
  Owe: { icon: <CreditCard size={24} />, color: '#f43f5e' },
  Goal: { icon: <Target size={24} />, color: '#c084fc' },
}

type Grouped = Record<string, EnvelopRow[]>

const ROW_CONFIG = [
  ['Expense'],
  ['Account', 'Income'],
  ['Savings', 'Investment', 'Goal', 'Lent', 'Owe'],
]

const EnvelopJars = () => {
  const [lcVisible, setLcVisible] = useState(false)
  const [rowVisible, setRowVisible] = useState<Record<number, boolean>>({ 0: true, 1: false, 2: false }) // row 0 (Expense) visible, others hidden by default
  const [grouped, setGrouped] = useState<Grouped>({})
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API_URL}/api/dashboard`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to load')
      setAccounts(body.accounts ?? [])
      const g: Grouped = {}
      for (const row of body.data as EnvelopRow[]) {
        const groupType = row.type.toLowerCase().includes('investment') ? 'Investment' : row.type
        if (!g[groupType]) g[groupType] = []
        g[groupType].push(row)
      }
      setGrouped(g)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <p className="loading-text">Loading envelops...</p>
  if (error) return <p className="error-text">⚠️ {error}</p>

  const hasAnyEnvelops = Object.keys(grouped).length > 0

  if (!hasAnyEnvelops)
    return <p className="empty-text">No active envelops. Go to <strong>Settings</strong> to create some!</p>

  const liquidCashTypes = ['Account', 'Expense', 'Savings', 'Goal']
  const liquidCash = Object.keys(grouped)
    .filter(type => liquidCashTypes.includes(type))
    .reduce((total, type) =>
      total + grouped[type].reduce((sum, e) => sum + parseFloat(e.last_balance || '0'), 0)
      , 0)

  return (
    <div className="envelop-jars-root">



      {ROW_CONFIG.map((rowTypes, idx) => {
        const activeTypes = rowTypes.filter(t => grouped[t])
        if (activeTypes.length === 0) return null

        return (
          <div key={idx} className="dashboard-row-section" style={{ marginBottom: '12px' }}>
            <div className="dashboard-row-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 4px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              {/* Left: text name for simple rows, icons only for dense rows (3+ categories) */}
              <div style={{ display: 'flex', gap: activeTypes.length >= 3 ? '8px' : '16px', alignItems: 'center' }}>
                {activeTypes.map(type => {
                  const m = TYPE_META[type] ?? { icon: <CreditCard size={18} />, color: '#8888a8' }
                  if (activeTypes.length >= 3) {
                    // compact: icon only with tooltip
                    return (
                      <span key={type} title={type} style={{ color: m.color, opacity: 0.85, display: 'flex' }}>{m.icon}</span>
                    )
                  }
                  // full: icon + bold text name
                  return (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: m.color, display: 'flex' }}>{m.icon}</span>
                      <span style={{ color: m.color, fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{type}</span>
                    </div>
                  )
                })}
              </div>

              {/* Right: combined total + EYE TOGGLE */}
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => setRowVisible(prev => ({ ...prev, [idx]: !prev[idx] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px', lineHeight: 1, display: 'flex', alignItems: 'center' }} title={rowVisible[idx] ? 'Hide section' : 'Show section'}>
                  {rowVisible[idx]
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  }
                </button>
                <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.5px' }}>
                  {rowVisible[idx]
                    ? `₹${activeTypes.reduce((sum, type) => sum + grouped[type].reduce((s, e) => s + parseFloat(e.last_balance || '0'), 0), 0).toLocaleString('en-IN')}`
                    : '₹ ••••••'
                  }
                </span>
              </div>
            </div>

            <div className="envelop-row-scroll">
              {activeTypes.map(type => (
                <div key={type} className="envelop-group-content" style={{ display: 'contents' }}>
                  <div className={GRID_CLASS[type] ?? 'jars-grid'} style={{ paddingRight: '16px' }}>
                    {(type === 'Expense'
                      ? [...grouped[type]].sort((a, b) => {
                        // Column-flow 2-row order: Needs, Want Lifestyle, Settlement Buffer, Want Discretionary
                        const ORDER: Record<string, number> = {
                          'Needs': 0,
                          'Want Lifestyle': 1,
                          'Settlement Buffer': 2,
                          'Want Discretionary': 3
                        }
                        const ai = ORDER[a.source_name] ?? 99
                        const bi = ORDER[b.source_name] ?? 99
                        return ai - bi
                      })
                      : grouped[type]
                    ).map((env: EnvelopRow) => (
                      <EnvelopCard key={env.id} env={env} allEnvelops={Object.values(grouped).flat() as EnvelopRow[]} onTransactionDone={load} visible={rowVisible[idx]} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Liquid Cash — compact console-style terminal line */}
      <div style={{ marginTop: '0', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.7rem', color: '#444', letterSpacing: '0.3px' }}>
        <span style={{ color: '#4ade80', fontWeight: 'bold' }}>$</span>
        <span style={{ color: '#38bdf8' }}>acc</span>
        <span style={{ color: '#333' }}>+</span>
        <span style={{ color: '#7c6ef7' }}>sav</span>
        <span style={{ color: '#333' }}>+</span>
        <span style={{ color: '#c084fc' }}>goal</span>
        <span style={{ color: '#333' }}>+</span>
        <span style={{ color: '#FF2D55' }}>xp_left</span>
        <span style={{ color: '#333' }}>=</span>
        <span style={{ color: '#e2e8f0', fontWeight: '800', fontSize: '0.8rem' }}>
          {lcVisible ? `₹${liquidCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ ••••••'}
        </span>
        <button onClick={() => setLcVisible(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', padding: '0 2px', lineHeight: 1, marginLeft: '4px' }}>
          {lcVisible
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
          }
        </button>
      </div>
    </div>
  )
}

export default EnvelopJars
