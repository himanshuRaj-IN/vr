import { useState } from 'react'
import { Link } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || ''

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

const defaultPayloads: Record<string, string> = {
  accounts: '{\n  "account_name": "Test Account",\n  "balance": 100.00\n}',
  envelops: '{\n  "source_name": "Groceries",\n  "type": "Expense",\n  "is_active": true\n}',
  transactions: `{\n  "transaction_date": "${new Date().toISOString().split('T')[0]}",\n  "source_name": "Supermarket",\n  "amount": 54.20,\n  "closing_balance": 946.30\n}`,
}

const ApiTester = () => {
  const [entity, setEntity] = useState('accounts')
  const [method, setMethod] = useState<Method>('GET')
  const [id, setId] = useState('')
  const [payload, setPayload] = useState(defaultPayloads['accounts'])
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleEntityChange = (v: string) => {
    setEntity(v)
    setPayload(defaultPayloads[v])
  }

  const handleSend = async () => {
    setLoading(true)
    setResponse(null)
    try {
      let url = `${API_URL}/api/${entity}`
      if (id) url += `?id=${id}`

      const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      }

      if (method === 'POST' || method === 'PUT') {
        try { JSON.parse(payload) } catch {
          setResponse({ parseError: 'Invalid JSON in payload.' })
          setLoading(false)
          return
        }
        opts.body = payload
      }

      const res = await fetch(url, opts)
      const data = await res.json()
      setResponse({ status: res.status, ok: res.ok, data })
    } catch (err: any) {
      setResponse({ status: 'Network Error', ok: false, data: { error: err.message } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Simple navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="logo-icon">🔌</div>
          API Tester
        </div>
      </nav>

      <div className="api-tester">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
        <h1>API Playground</h1>
        <p className="sub">Test your Vercel serverless endpoints directly against your Neon database.</p>

        <div className="api-form">
          <div className="input-row">
            <div className="form-group">
              <label>Entity Table</label>
              <select id="entity-select" value={entity} onChange={(e) => handleEntityChange(e.target.value)}>
                <option value="accounts">Accounts</option>
                <option value="envelops">Envelops</option>
                <option value="transactions">Transactions</option>
              </select>
            </div>

            <div className="form-group">
              <label>HTTP Method</label>
              <select id="method-select" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                <option value="GET">GET — Fetch</option>
                <option value="POST">POST — Create</option>
                <option value="PUT">PUT — Update</option>
                <option value="DELETE">DELETE — Remove</option>
              </select>
            </div>

            <div className="form-group">
              <label>Record ID (optional)</label>
              <input
                id="record-id-input"
                type="number"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. 1 (leave empty for ALL)"
              />
            </div>
          </div>

          {(method === 'POST' || method === 'PUT') && (
            <div className="form-group">
              <label>JSON Body Payload</label>
              <textarea
                id="payload-input"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
              />
            </div>
          )}

          <button id="send-btn" className="send-btn" onClick={handleSend} disabled={loading}>
            {loading ? '⏳ Sending...' : '🚀 Send Request'}
          </button>
        </div>

        {response && (
          <div className="response-box">
            <h3>Response</h3>
            {response.parseError ? (
              <p style={{ color: 'var(--error)', fontSize: '0.88rem' }}>{response.parseError}</p>
            ) : (
              <>
                <span className={`status-badge ${response.ok ? 'status-ok' : 'status-err'}`}>
                  {response.status} {response.ok ? '✓ OK' : '✗ Error'}
                </span>
                <pre className="response-json">{JSON.stringify(response.data, null, 2)}</pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ApiTester
