import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Props {
  sourceName: string    // Account envelop name e.g. "HDFC Savings"
  onClose: () => void
  onSuccess: () => void
}

type TabMode = 'income' | 'adjustment'
type AdjustDir = 'positive' | 'negative'

const AccountDepositModal = ({ sourceName, onClose, onSuccess }: Props) => {
  const today = new Date().toISOString().split('T')[0]
  const [tab, setTab]           = useState<TabMode>('income')
  const [amount, setAmount]     = useState('')
  const [incomeName, setIncomeName] = useState('')
  const [adjDir, setAdjDir]     = useState<AdjustDir>('positive')
  const [date, setDate]         = useState(today)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Auto-name for adjustment tab
  const adjustmentName = adjDir === 'positive' ? '+ve Adjustment' : '-ve Adjustment'

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Reset fields when switching tabs
  const switchTab = (t: TabMode) => {
    setTab(t)
    setAmount('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawAmt = parseFloat(amount)
    if (!amount || isNaN(rawAmt) || rawAmt <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }

    // Determine signed amount and name
    let signedAmount: number
    let txName: string

    if (tab === 'income') {
      signedAmount = rawAmt                     // always +ve
      txName       = incomeName.trim() || 'Income'
    } else {
      signedAmount = adjDir === 'positive' ? rawAmt : -rawAmt
      txName       = adjustmentName
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_name:      sourceName,
          amount:           signedAmount,
          name:             txName,
          transaction_date: date,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Transaction failed')
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <span>🏛️</span>
            <div>
              <div className="modal-heading">Account Credit</div>
              <div className="modal-sub">{sourceName}</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} id="acc-modal-close">✕</button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            id="tab-income"
            className={`modal-tab ${tab === 'income' ? 'active' : ''}`}
            type="button"
            onClick={() => switchTab('income')}
          >
            💼 Income
          </button>
          <button
            id="tab-adjustment"
            className={`modal-tab ${tab === 'adjustment' ? 'active' : ''}`}
            type="button"
            onClick={() => switchTab('adjustment')}
          >
            🔧 Adjustment
          </button>
        </div>

        {/* Form */}
        <form className="modal-form" onSubmit={handleSubmit} style={{ marginTop: '16px' }}>

          {/* Income tab: free name input */}
          {tab === 'income' && (
            <div className="form-group">
              <label>Income Name</label>
              <input
                id="income-name"
                type="text"
                placeholder='e.g. Salary March, Freelance, Interest'
                value={incomeName}
                onChange={(e) => setIncomeName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* Adjustment tab: direction selector + auto name preview */}
          {tab === 'adjustment' && (
            <div className="form-group">
              <label>Direction</label>
              <div className="adj-toggle">
                <button
                  type="button"
                  id="adj-positive"
                  className={`adj-btn ${adjDir === 'positive' ? 'adj-selected-pos' : ''}`}
                  onClick={() => setAdjDir('positive')}
                >
                  ＋ Positive
                </button>
                <button
                  type="button"
                  id="adj-negative"
                  className={`adj-btn ${adjDir === 'negative' ? 'adj-selected-neg' : ''}`}
                  onClick={() => setAdjDir('negative')}
                >
                  － Negative
                </button>
              </div>
              <p className="adj-name-preview">
                Transaction name: <strong>{adjustmentName}</strong>
              </p>
            </div>
          )}

          {/* Amount */}
          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              id="acc-modal-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 50000.00"
              value={amount}
              autoFocus={tab === 'adjustment'}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Date */}
          <div className="form-group">
            <label>Date</label>
            <input
              id="acc-modal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Error */}
          {error && <p className="flash-msg flash-err" style={{ margin: 0 }}>{error}</p>}

          {/* Submit */}
          <button
            id="acc-modal-submit"
            className="send-btn"
            type="submit"
            disabled={saving}
            style={{
              background: tab === 'income'
                ? 'var(--success)'
                : adjDir === 'positive'
                  ? '#38bdf8'
                  : 'var(--error)',
              marginTop: '4px',
            }}
          >
            {saving
              ? 'Saving...'
              : tab === 'income'
                ? `💼 Record Income`
                : `🔧 Apply ${adjDir === 'positive' ? '+ve' : '-ve'} Adjustment`}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AccountDepositModal
