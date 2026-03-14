import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthGate from '../components/AuthGate'

const API_URL = import.meta.env.VITE_API_URL || ''

// ─── Types ───────────────────────────────────────
interface Envelop {
  id: number
  source_name: string
  type: string
  is_active: boolean
  target_amount: string | null
  target_date: string | null
  last_balance: string | null
  timeframe: number | null
}

interface Account {
  id: number
  account_name: string
  balance: number
}

// ─── Reusable form field ──────────────────────────
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="form-group">
    <label>{label}</label>
    {children}
  </div>
)

// ─── Envelops Tab ────────────────────────────────
const EnvelopsTab = () => {
  const [list, setList] = useState<Envelop[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Create form
  const [form, setForm] = useState({ source_name: '', type: 'Expense', is_active: true, timeframe: '', target_amount: '' })

  // Edit state
  const [editing, setEditing] = useState<Envelop | null>(null)

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  const fetchEnvelops = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/envelops`)
      const data = await res.json()
      setList(data.data || [])
    } catch {
      flash('Failed to load envelops.', false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEnvelops() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.source_name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/envelops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash('Envelop created!', true)
      setForm({ source_name: '', type: 'Expense', is_active: true, timeframe: '', target_amount: '' })
      fetchEnvelops()
    } catch (err: any) {
      flash(err.message || 'Create failed.', false)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/envelops?id=${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_name: editing.source_name,
          type: editing.type,
          is_active: editing.is_active,
          timeframe: editing.timeframe ?? null,
          target_amount: editing.target_amount ?? null,
          target_date: editing.target_date ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash('Envelop updated!', true)
      setEditing(null)
      fetchEnvelops()
    } catch (err: any) {
      flash(err.message || 'Update failed.', false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section">
      {/* Flash message */}
      {msg && (
        <div className={`flash-msg ${msg.ok ? 'flash-ok' : 'flash-err'}`}>{msg.text}</div>
      )}

      {/* Create Form */}
      <div className="settings-card">
        <h3 className="settings-card-title">➕ Add New Envelop</h3>
        <form onSubmit={handleCreate} className="settings-form">
          <div className="input-row">
            <Field label="Source / Name">
              <input
                id="env-source-name"
                type="text"
                placeholder="e.g. Groceries"
                value={form.source_name}
                onChange={(e) => setForm({ ...form, source_name: e.target.value })}
                required
              />
            </Field>
            <Field label="Type">
              <select
                id="env-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="Account">Account (Bank)</option>
                <option value="Expense">Expense</option>
                <option value="Income">Income</option>
                <option value="Savings">Savings</option>
                <option value="Investment">Investment</option>
                <option value="Lent">Lent (Owed to Me)</option>
                <option value="Owe">Owe (Debt)</option>
                <option value="Goal">Goal (Target)</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                id="env-status"
                value={form.is_active ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
          {/* Timeframe — shown for non-Account types */}
          {form.type !== 'Account' && (
            <div className="input-row">
              <Field label="Tracking Period (days)">
                <input
                  type="number"
                  placeholder="e.g. 30"
                  value={form.timeframe}
                  onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                />
              </Field>
              <Field label="Target/Budget (₹)">
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2000"
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                />
              </Field>
            </div>
          )}
          <button id="env-create-btn" className="send-btn" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Create Envelop'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title" style={{ margin: 0 }}>📋 Your Envelops</h3>
          <button id="env-refresh-btn" className="icon-btn" onClick={fetchEnvelops} title="Refresh">🔄</button>
        </div>

        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : list.length === 0 ? (
          <p className="empty-text">No envelops found. Create one above!</p>
        ) : (
          <div className="list-grid">
            {list.map((env) =>
              editing?.id === env.id ? (
                // Edit inline form
                <form key={env.id} className="list-item-edit" onSubmit={handleUpdate}>
                  <div className="input-row">
                    <Field label="Name">
                      <input
                        type="text"
                        value={editing.source_name}
                        onChange={(e) => setEditing({ ...editing, source_name: e.target.value })}
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        value={editing.type}
                        onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                      >
                        <option value="Account">Account (Bank)</option>
                        <option value="Expense">Expense</option>
                        <option value="Income">Income</option>
                        <option value="Savings">Savings</option>
                        <option value="Investment">Investment</option>
                        <option value="Lent">Lent (Owed to Me)</option>
                        <option value="Owe">Owe (Debt)</option>
                        <option value="Goal">Goal (Target)</option>
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        value={editing.is_active ? 'true' : 'false'}
                        onChange={(e) => setEditing({ ...editing, is_active: e.target.value === 'true' })}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </Field>
                    <Field label="Budget">
                      <input
                        type="number"
                        step="0.01"
                        value={editing.target_amount || ''}
                        onChange={(e) => setEditing({ ...editing, target_amount: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="edit-actions">
                    <button className="send-btn" type="submit" disabled={saving} style={{ flex: 1, padding: '8px' }}>
                      {saving ? 'Saving...' : '✓ Save'}
                    </button>
                    <button type="button" className="icon-btn" onClick={() => setEditing(null)}>✕</button>
                  </div>
                </form>
              ) : (
                <div key={env.id} className="list-item">
                  <div className="list-item-info">
                    <span className="list-item-name">{env.source_name}</span>
                    <span className={`badge ${env.type.toLowerCase()}`}>{env.type}</span>
                    <span className={`badge ${env.is_active ? 'active' : 'inactive'}`}>
                      {env.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <button
                    id={`env-edit-${env.id}`}
                    className="icon-btn"
                    title="Edit"
                    onClick={() => setEditing(env)}
                  >
                    ✏️
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Accounts Tab ────────────────────────────────
const AccountsTab = () => {
  const [list, setList] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [form, setForm] = useState({ account_name: '', balance: '' })
  const [editing, setEditing] = useState<Account | null>(null)

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/accounts`)
      const data = await res.json()
      setList(data.data || [])
    } catch {
      flash('Failed to load accounts.', false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAccounts() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.account_name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_name: form.account_name, balance: parseFloat(form.balance) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash('Account created!', true)
      setForm({ account_name: '', balance: '' })
      fetchAccounts()
    } catch (err: any) {
      flash(err.message || 'Create failed.', false)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/accounts?id=${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_name: editing.account_name, balance: editing.balance }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash('Account updated!', true)
      setEditing(null)
      fetchAccounts()
    } catch (err: any) {
      flash(err.message || 'Update failed.', false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section">
      {msg && (
        <div className={`flash-msg ${msg.ok ? 'flash-ok' : 'flash-err'}`}>{msg.text}</div>
      )}

      {/* Create Form */}
      <div className="settings-card">
        <h3 className="settings-card-title">➕ Add New Bank Account</h3>
        <form onSubmit={handleCreate} className="settings-form">
          <div className="input-row">
            <Field label="Account Name">
              <input
                id="acc-name"
                type="text"
                placeholder="e.g. HDFC Savings"
                value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                required
              />
            </Field>
            <Field label="Opening Balance (₹)">
              <input
                id="acc-balance"
                type="number"
                step="0.01"
                placeholder="e.g. 10000.00"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </Field>
          </div>
          <button id="acc-create-btn" className="send-btn" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Create Account'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title" style={{ margin: 0 }}>🏦 Your Bank Accounts</h3>
          <button id="acc-refresh-btn" className="icon-btn" onClick={fetchAccounts} title="Refresh">🔄</button>
        </div>

        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : list.length === 0 ? (
          <p className="empty-text">No accounts found. Create one above!</p>
        ) : (
          <div className="list-grid">
            {list.map((acc) =>
              editing?.id === acc.id ? (
                <form key={acc.id} className="list-item-edit" onSubmit={handleUpdate}>
                  <div className="input-row">
                    <Field label="Account Name">
                      <input
                        type="text"
                        value={editing.account_name}
                        onChange={(e) => setEditing({ ...editing, account_name: e.target.value })}
                      />
                    </Field>
                    <Field label="Balance (₹)">
                      <input
                        type="number"
                        step="0.01"
                        value={editing.balance}
                        onChange={(e) => setEditing({ ...editing, balance: parseFloat(e.target.value) })}
                      />
                    </Field>
                  </div>
                  <div className="edit-actions">
                    <button className="send-btn" type="submit" disabled={saving} style={{ flex: 1, padding: '8px' }}>
                      {saving ? 'Saving...' : '✓ Save'}
                    </button>
                    <button type="button" className="icon-btn" onClick={() => setEditing(null)}>✕</button>
                  </div>
                </form>
              ) : (
                <div key={acc.id} className="list-item">
                  <div className="list-item-info">
                    <span className="list-item-name">{acc.account_name}</span>
                    <span className="badge savings">₹ {Number(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <button
                    id={`acc-edit-${acc.id}`}
                    className="icon-btn"
                    title="Edit"
                    onClick={() => setEditing(acc)}
                  >
                    ✏️
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Distribute Tab ──────────────────────────────
const DistributeTab = ({ envelops }: { envelops: Envelop[] }) => {
  const [sources, setSources] = useState<Envelop[]>([])
  const [mode, setMode] = useState<'distribute' | 'collect'>('distribute')
  const [selectedMain, setSelectedMain] = useState('')
  const [targets, setTargets] = useState<{ id: number; name: string; amount: string; current_balance: string; budget: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    setSources(envelops.filter(e => e.type === 'Account' || e.type === 'Income'))
    
    // Distribute: Focus on Expenses + Savings/Goals
    // Collect: All non-account active envelopes with balance
    const filtered = envelops.filter(e => {
      // If is_active is missing (from API), assume it's true because the dashboard API only returns active ones
      if (e.is_active === false) return false 
      return e.type === 'Expense'
    })

    setTargets(filtered.map(e => ({
      id: e.id,
      name: e.source_name,
      amount: mode === 'distribute' ? (e.target_amount || '0') : (e.last_balance || '0'),
      current_balance: e.last_balance || '0',
      budget: e.target_amount || '0'
    })))
  }, [envelops, mode])

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  const handleExecute = async () => {
    if (!selectedMain) return flash(`Please select a ${mode === 'distribute' ? 'source' : 'target'} account`, false)
    const activeDists = targets.filter(t => (parseFloat(t.amount) || 0) > 0)
    if (activeDists.length === 0) return flash('No amounts to process', false)

    setSaving(true)
    let count = 0
    try {
      for (const d of activeDists) {
        // Distribute: fromMain -> toEnvelop
        // Collect: fromEnvelop -> toMain
        const from = mode === 'distribute' ? selectedMain : d.name
        const target = mode === 'distribute' ? d.name : selectedMain
        
        const res = await fetch(`${API_URL}/api/topup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_source_name: from,
            target_source_name: target,
            amount: d.amount,
            transaction_date: new Date().toISOString().split('T')[0],
            name: mode === 'distribute' ? 'Budget Distribution' : 'Balance Collection'
          })
        })
        if (!res.ok) {
          const body = await res.json()
          throw new Error(`Failed on ${d.name}: ${body.error}`)
        }
        count++
      }
      flash(`Successfully ${mode === 'distribute' ? 'distributed' : 'collected'} ${count} categories!`, true)
    } catch (err: any) {
      flash(err.message, false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section">
      {msg && <div className={`flash-msg ${msg.ok ? 'flash-ok' : 'flash-err'}`}>{msg.text}</div>}
      
      <div className="settings-card">
        <div className="settings-tabs" style={{ background: 'rgba(0,0,0,0.2)', marginBottom: '30px' }}>
          <button className={`tab-btn ${mode === 'distribute' ? 'active' : ''}`} onClick={() => setMode('distribute')}>📤 Distribute</button>
          <button className={`tab-btn ${mode === 'collect' ? 'active' : ''}`} onClick={() => setMode('collect')}>📥 Collect All</button>
        </div>

        <h3 className="settings-card-title">
          {mode === 'distribute' ? '💸 Distribute Funds' : '🧹 Sweep/Collect All'}
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '20px' }}>
          {mode === 'distribute' 
            ? 'Top-up multiple categories from a single source.' 
            : 'Zero out your envelopes by pulling their current balances back to an account.'}
        </p>

        <Field label={mode === 'distribute' ? 'Transfer From' : 'Transfer To'}>
          <select value={selectedMain} onChange={e => setSelectedMain(e.target.value)} style={{ width: '100%', padding: '12px' }}>
            <option value="">Select {mode === 'distribute' ? 'source' : 'target'} account...</option>
            {sources.map(s => <option key={s.id} value={s.source_name}>{s.source_name}</option>)}
          </select>
        </Field>

        <div style={{ marginTop: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '1rem', color: '#333' }}>Envelopes</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {targets.map((t, idx) => (
              <div key={t.id} className="distribute-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{t.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                    Balance: ₹{Number(t.current_balance).toLocaleString()} · Budget: ₹{Number(t.budget).toLocaleString()}
                  </div>
                </div>
                <input
                  type="number"
                  value={t.amount}
                  onChange={e => {
                    const newT = [...targets]
                    newT[idx].amount = e.target.value
                    setTargets(newT)
                  }}
                  style={{ width: '120px', textAlign: 'right' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#888' }}>Total To {mode === 'distribute' ? 'Distribute' : 'Collect'}:</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: mode === 'distribute' ? '#4ade80' : '#fb923c' }}>
              ₹{targets.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <button 
          className="send-btn" 
          style={{ 
            marginTop: '20px', 
            width: '100%', 
            fontSize: '1.1rem', 
            padding: '16px',
            background: mode === 'distribute' ? '' : 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
            borderColor: mode === 'distribute' ? '' : '#fb923c'
          }} 
          disabled={saving}
          onClick={handleExecute}
        >
          {saving ? 'Processing...' : `🚀 Execute ${mode === 'distribute' ? 'Distribution' : 'Collection'}`}
        </button>
      </div>
    </div>
  )
}

// ─── Settings Page ───────────────────────────────
const Settings = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'envelops' | 'accounts' | 'distribute'>('envelops')
  const [envelops, setEnvelops] = useState<Envelop[]>([])

  const fetchEnvelops = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard`)
      const body = await res.json()
      setEnvelops(body.data || [])
    } catch (e) { console.error(e) }
  }

  useEffect(() => { fetchEnvelops() }, [])

  return (
    <AuthGate>
      <div className="settings-page">
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="logo-icon">⚙️</div>
            Settings
          </div>
          <div className="navbar-actions">
            <button id="settings-back-btn" className="icon-btn" title="Dashboard" onClick={() => navigate('/')}>
              🏠
            </button>
          </div>
        </nav>

        <div className="page">
          <div className="page-heading">
            <h1>Settings</h1>
            <p>Manage your envelops and distribute funds.</p>
          </div>

          <div className="settings-tabs">
            <button className={`tab-btn ${tab === 'envelops' ? 'active' : ''}`} onClick={() => setTab('envelops')}>📁 Envelops</button>
            <button className={`tab-btn ${tab === 'accounts' ? 'active' : ''}`} onClick={() => setTab('accounts')}>🏦 Accounts</button>
            <button className={`tab-btn ${tab === 'distribute' ? 'active' : ''}`} onClick={() => { setTab('distribute'); fetchEnvelops(); }}>💸 Distribute</button>
          </div>

          {tab === 'envelops' && <EnvelopsTab />}
          {tab === 'accounts' && <AccountsTab />}
          {tab === 'distribute' && <DistributeTab envelops={envelops} />}
        </div>
      </div>
    </AuthGate>
  )
}

export default Settings
