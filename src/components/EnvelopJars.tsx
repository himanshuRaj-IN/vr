import { useState, useEffect } from 'react'
import TransactionModal from './TransactionModal'
import AccountDepositModal from './AccountDepositModal'

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
  return '#f87171'
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
  const isIconOnly = env.type === 'Savings' || env.type === 'Goal' || env.type === 'Lent' || env.type === 'Owe' 
  
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
          <button id={`topup-${env.id}`} className="xp-icon-btn" onClick={onTopup} title={topupLabel} style={{ borderColor: accentBg, color: accentColor }}>💰</button>
          <button id={`expense-${env.id}`} className="xp-icon-btn" onClick={onExpense} title={expenseLabel} style={{ borderColor: 'rgba(244,63,94,0.3)', color: '#f43f5e' }}>💸</button>
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
        💰 {topupLabel}
      </button>
      <button id={`expense-${env.id}`} className="card-action-btn expense" onClick={onExpense} title={expenseLabel}>
        💸 {expenseLabel}
      </button>
    </div>
  )
}

// ─── ACCOUNT CARD ─────────────────────────────────────────────────────────────
const AccountCard = ({ env, onDeposit, onTopup }: { env: EnvelopRow; onDeposit: () => void; onTopup: () => void }) => (
  <div className="env-card env-account">
    <div className="env-account-left">
      <div className="env-card-icon">🏛️</div>
      <div>
        <div className="env-card-name">{env.source_name}</div>
        <div className="env-card-tag">Bank Account</div>
      </div>
    </div>
    <div className="env-account-right">
      <div className="env-account-balance">{fmt(env.last_balance)}</div>
      {fmtDate(env.last_date) && <div className="env-card-date">Updated {fmtDate(env.last_date)}</div>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button id={`acc-deposit-${env.id}`} className="card-action-btn topup" style={{ flex: 1 }} onClick={onDeposit}>
          + Credit
        </button>
        <button id={`acc-transfer-${env.id}`} className="xp-icon-btn" onClick={onTopup} title="Transfer In" style={{ borderColor: 'rgba(56,189,248,0.3)', color: '#38bdf8', padding: '0 10px', height: '36px' }}>
          💰
        </button>
      </div>
    </div>
  </div>
)

// ─── EXPENSE CARD (Green top, Red bottom linear fill + Inline Form) ───────────
const ExpenseCard = ({
  env, onTopup, onTransactionDone
}: { env: EnvelopRow; onTopup: () => void; onTransactionDone: () => void }) => {
  const [isAdding, setIsAdding] = useState(false)
  const [amt, setAmt] = useState('')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

  return (
    <div className="xp-card">
      {/* Red liquid fill — rises from bottom, clean linear gradient separation */}
      <div
        className="xp-fill"
        style={{ height: `${fillPct}%` }}
      />

      {/* Content layer — sits above the fill */}
      <div className="xp-content">
        {/* Top row: name left · balance right */}
        <div className="xp-top">
          <span className="xp-name">{env.source_name}</span>
          <span className="xp-balance">{fmt(env.last_balance)}</span>
        </div>

        {/* Mid: Central Spend Button or Inline Form */}
        <div className="xp-mid" style={{ justifyContent: 'center', flex: 1, alignItems: 'center' }}>
          {!isAdding ? (
            <button
              className="xp-center-btn"
              onClick={() => setIsAdding(true)}
              title="Spend"
              style={{ animationDelay: floatDelay, animationDuration: floatDuration }}
            >
              💸
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
                <button type="button" className="xp-inline-cancel" title="Cancel" onClick={() => { setIsAdding(false); setError(null); }}>✕</button>
                <button type="submit" className="xp-inline-submit" title="Save" disabled={saving}>
                  {saving ? '⏳' : '✓'}
                </button>
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
            <button id={`topup-${env.id}`} className="xp-icon-btn" onClick={onTopup} title="Top Up">💰</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DEFAULT CARD (Income / Investment) ───────────────────────────────────────
const DefaultCard = ({
  env, onTopup, onExpense
}: { env: EnvelopRow; onTopup: () => void; onExpense: () => void }) => {
  const META: Record<string, { icon: string; color: string; bg: string }> = {
    Income: { icon: '📈', color: '#4ade80', bg: 'rgba(74,222,128,0.07)' },
    Investment: { icon: '📊', color: '#fbbf24', bg: 'rgba(251,191,36,0.07)' },
    Lent: { icon: '🤝', color: '#fb923c', bg: 'rgba(251,146,60,0.07)' },
    Owe: { icon: '💳', color: '#f43f5e', bg: 'rgba(244,63,94,0.07)' },
    Goal: { icon: '🎯', color: '#c084fc', bg: 'rgba(192,132,252,0.07)' },
  }
  const m = META[env.type] ?? { icon: '📁', color: '#8888a8', bg: 'rgba(136,136,168,0.07)' }

  return (
    <div className="env-card env-default" style={{ borderColor: m.color + '40', background: m.bg }}>
      <div className="env-default-top">
        <span style={{ fontSize: '22px' }}>{m.icon}</span>
        <span className="env-card-tag" style={{ color: m.color, background: m.color + '20' }}>{env.type}</span>
      </div>
      <div className="env-card-name" style={{ marginTop: '8px' }}>{env.source_name}</div>
      <div className="env-default-balance" style={{ color: m.color }}>{fmt(env.last_balance)}</div>
      {env.target_amount && (
        <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 'bold', marginTop: '4px' }}>
          Target: {fmt(env.target_amount)} ({Math.round((parseFloat(env.last_balance || '0') / parseFloat(env.target_amount)) * 100)}%)
        </div>
      )}
      {fmtDate(env.last_date) && <div className="env-card-date">{fmtDate(env.last_date)}</div>}
      
      {(env.type === 'Goal' || env.type === 'Savings' || env.type === 'Lent' || env.type === 'Owe') && env.balance_history && (
        <Sparkline data={env.balance_history} color="#4ade80" />
      )}

      <ActionBtns env={env} onTopup={onTopup} onExpense={onExpense} />
    </div>
  )
}

// ─── INVESTMENT CARD ──────────────────────────────────────────────────────────
const InvestmentCard = ({
  env, onTopup, onExpense
}: { env: EnvelopRow; onTopup: () => void; onExpense: () => void }) => {
  const m = { icon: '📊', color: '#fbbf24', bg: 'rgba(251,191,36,0.07)' }

  return (
    <div className="env-card env-default" style={{ borderColor: m.color + '40', background: m.bg }}>
      <div className="env-default-top">
        <span style={{ fontSize: '22px' }}>{m.icon}</span>
        <span className="env-card-tag" style={{ color: m.color, background: m.color + '20' }}>{env.type}</span>
      </div>
      <div className="env-card-name" style={{ marginTop: '8px' }}>{env.source_name}</div>
      <div className="env-default-balance" style={{ color: m.color }}>{fmt(env.last_balance)}</div>
      {env.target_amount && (
        <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 'bold', marginTop: '4px' }}>
          Target: {fmt(env.target_amount)} ({Math.round((parseFloat(env.last_balance || '0') / parseFloat(env.target_amount)) * 100)}%)
        </div>
      )}
      {fmtDate(env.last_date) && <div className="env-card-date">{fmtDate(env.last_date)}</div>}
      
      {env.balance_history && (
        <Sparkline data={env.balance_history} color="#4ade80" />
      )}

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button id={`topup-${env.id}`} className="xp-icon-btn" onClick={onTopup} title="Invest" style={{ borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }}>💰</button>
          <button id={`expense-${env.id}`} className="xp-icon-btn" onClick={onExpense} title="Withdraw" style={{ borderColor: 'rgba(244,63,94,0.3)', color: '#f43f5e' }}>💸</button>
        </div>
        {env.timeframe 
          ? <span className="xp-timeframe">{env.timeframe} Days</span>
          : null
        }
      </div>
    </div>
  )
}

// ─── JAR CARD WRAPPER (handles modals per card) ───────────────────────────────
const EnvelopCard = ({ env, allEnvelops, onTransactionDone }: {
  env: EnvelopRow; allEnvelops: EnvelopRow[]; onTransactionDone: () => void
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
      {env.type === 'Account' && <AccountCard env={env} onDeposit={onDeposit} onTopup={onTopup} />}
      {env.type === 'Expense' && <ExpenseCard env={env} onTopup={onTopup} onTransactionDone={done} />}
      {env.type === 'Investment' && <InvestmentCard env={env} onTopup={onTopup} onExpense={onExpense} />}
      {(env.type === 'Income' || env.type === 'Savings' || env.type === 'Lent' || env.type === 'Owe' || env.type === 'Goal') &&
        <DefaultCard env={env} onTopup={onTopup} onExpense={onExpense} />}

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
  Lent: 'jars-grid-default',
  Owe: 'jars-grid-default',
  Goal: 'jars-grid-default',
}

const TYPE_META: Record<string, { icon: string; color: string }> = {
  Account: { icon: '🏛️', color: '#38bdf8' },
  Expense: { icon: '💸', color: '#f87171' },
  Savings: { icon: '🏦', color: '#7c6ef7' },
  Income: { icon: '📈', color: '#4ade80' },
  Investment: { icon: '📊', color: '#fbbf24' },
  Lent: { icon: '🤝', color: '#fb923c' },
  Owe: { icon: '💳', color: '#f43f5e' },
  Goal: { icon: '🎯', color: '#c084fc' },
}

type Grouped = Record<string, EnvelopRow[]>

const ROW_CONFIG = [
  ['Account', 'Income'],
  ['Expense'],
  ['Investment', 'Savings', 'Goal'],
  ['Lent', 'Owe']
]

const EnvelopJars = () => {
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
        if (!g[row.type]) g[row.type] = []
        g[row.type].push(row)
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
      {/* Liquid Cash Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Liquid Cash</div>
          <div className="value" style={{ color: 'var(--success)' }}>
            ₹{liquidCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
            Accounts + Left Expenses + Savings + Goals
          </div>
        </div>
      </div>


      {ROW_CONFIG.map((rowTypes, idx) => {
        const activeTypes = rowTypes.filter(t => grouped[t])
        if (activeTypes.length === 0) return null

        return (
          <div key={idx} className="dashboard-row-section" style={{ marginBottom: '40px' }}>
            <div className="dashboard-row-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', padding: '0 4px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                {activeTypes.map(type => {
                  const m = TYPE_META[type] ?? { icon: '📁', color: '#8888a8' }
                  return (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{m.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: m.color, fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>{type}</span>
                        <span style={{ color: '#555', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '2px' }}>{grouped[type].length} JARS</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ textAlign: 'right', display: 'flex', gap: '32px' }}>
                {activeTypes.map(type => {
                   const m = TYPE_META[type] ?? { icon: '📁', color: '#8888a8' }
                   const total = grouped[type].reduce((sum, e) => sum + parseFloat(e.last_balance || '0'), 0)
                   let label = type === 'Expense' ? 'Left Balance' : `Total ${type}`
                   let valueDisplay = `₹${total.toLocaleString('en-IN')}`

                   if (type === 'Goal') {
                     label = 'Achieved / Target'
                     const targetTotal = grouped[type].reduce((sum, e) => sum + parseFloat(e.target_amount || '0'), 0)
                     valueDisplay = `₹${total.toLocaleString('en-IN')} / ₹${targetTotal.toLocaleString('en-IN')}`
                   }

                   return (
                     <div key={type}>
                        <span style={{ color: '#666', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '2px' }}>{label}</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: '900', color: m.color, letterSpacing: '-0.5px' }}>
                          {valueDisplay}
                        </span>
                     </div>
                   )
                })}
              </div>
            </div>

            <div className="envelop-row-scroll">
              {activeTypes.map(type => (
                <div key={type} className="envelop-group-content" style={{ display: 'contents' }}>
                  <div className={GRID_CLASS[type] ?? 'jars-grid'} style={{ marginRight: '40px' }}>
                    {grouped[type].map((env: EnvelopRow) => (
                      <EnvelopCard key={env.id} env={env} allEnvelops={Object.values(grouped).flat() as EnvelopRow[]} onTransactionDone={load} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default EnvelopJars
