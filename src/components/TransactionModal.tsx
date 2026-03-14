import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Account { id: number; source_name: string; type?: string }

interface Props {
  mode: 'topup' | 'expense'
  sourceName: string
  targetType?: string        // helps determine visual/naming behavior (e.g., 'Lent')
  accounts: Account[]        // pre-loaded from dashboard call, now contains all envelops!
  onClose: () => void
  onSuccess: () => void      // triggers jar refresh
}

const TransactionModal = ({ mode, sourceName, targetType, accounts, onClose, onSuccess }: Props) => {
  const isTopup = mode === 'topup'
  const today = new Date().toISOString().split('T')[0]

  const [fromAccount, setFromAccount] = useState('')
  const [amount, setAmount]           = useState('')
  const [name, setName]               = useState('')
  const [date, setDate]               = useState(today)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // Trap focus within modal on mount
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than 0.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      let res: Response
      
      let finalName = name.trim()
      if (isTopup) {
         const fromType = accounts.find(a => a.source_name === fromAccount)?.type

         const isTargetLent = targetType === 'Lent' || sourceName.toLowerCase().includes('lent') || sourceName.toLowerCase().includes('lend')
         const isSourceLent = fromType === 'Lent' || fromAccount.toLowerCase().includes('lent') || fromAccount.toLowerCase().includes('lend')

         // Auto-append tracking tags for Lent operations if the user didn't write them
         if (isTargetLent && !finalName.includes('(Lent)')) finalName = finalName ? `${finalName} (Lent)` : '(Lent)'
         if (isSourceLent && !finalName.includes('(Settle)')) finalName = finalName ? `${finalName} (Settle)` : '(Settle)'
      }

      if (isTopup) {
        res = await fetch(`${API_URL}/api/topup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_source_name: sourceName,
            from_source_name: fromAccount,
            amount: parseFloat(amount),
            name: finalName,
            transaction_date: date,
          }),
        })
      } else {
        res = await fetch(`${API_URL}/api/expense`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_name: sourceName,
            amount: parseFloat(amount),
            name: finalName,
            transaction_date: date,
          }),
        })
      }

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

  const isTargetLent = targetType === 'Lent' || sourceName.toLowerCase().includes('lent') || sourceName.toLowerCase().includes('lend')

  return (
    // Backdrop
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <span>{isTopup ? (isTargetLent ? '🤝' : '💰') : '💸'}</span>
            <div>
              <div className="modal-heading">
                {isTopup ? (isTargetLent ? 'Lend Money' : 'Top Up') : 'Record Expense'}
              </div>
              <div className="modal-sub">{sourceName}</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close" id="modal-close-btn">✕</button>
        </div>

        {/* Form */}
        <form className="modal-form" onSubmit={handleSubmit}>
          {/* From Account — only for topup */}
          {isTopup && (
            <div className="form-group">
              <label>From Envelop</label>
              {accounts.length === 0 ? (
                <p className="empty-text" style={{ padding: '8px 0', textAlign: 'left' }}>
                  No other envelops available for transfer.
                </p>
              ) : (
                <select
                  id="modal-from-account"
                  value={fromAccount}
                  onChange={(e) => setFromAccount(e.target.value)}
                  required
                >
                  <option value="" disabled>Select source...</option>
                  {/* Group envelops contextually for better UX */}
                  {['Account', 'Income', 'Savings', 'Investment', 'Goal', 'Owe', 'Lent', 'Expense'].map(typeAttr => {
                    const grp = accounts.filter(a => a.type === typeAttr)
                    if (!grp.length) return null
                    return (
                      <optgroup key={typeAttr} label={typeAttr + 's'}>
                        {grp.map(a => <option key={a.id} value={a.source_name}>{a.source_name}</option>)}
                      </optgroup>
                    )
                  })}
                  {/* Fallback for any envelops without a type properly mapped in the list above */}
                  {accounts.filter(a => !['Account', 'Income', 'Savings', 'Investment', 'Goal', 'Owe', 'Lent', 'Expense'].includes(a.type || '')).map(a => (
                     <option key={a.id} value={a.source_name}>{a.source_name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              id="modal-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 500.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Name / Description */}
          <div className="form-group">
            <label>Name / Description</label>
            <input
              id="modal-name"
              type="text"
              placeholder={isTopup ? 'e.g. Monthly budget' : 'e.g. Big Basket'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="form-group">
            <label>Date</label>
            <input
              id="modal-date"
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
            id="modal-submit-btn"
            className="send-btn"
            type="submit"
            disabled={saving || (isTopup && accounts.length === 0)}
            style={{ background: isTopup ? 'var(--success)' : 'var(--error)', marginTop: '4px' }}
          >
            {saving
              ? 'Saving...'
              : isTopup
                ? (isTargetLent ? `🤝 Lend to ${sourceName}` : `💰 Top Up ${sourceName}`)
                : `💸 Record ₹${amount || '0'} Expense`}
          </button>
        </form>
      </div>
    </div>
  )
}

export default TransactionModal
