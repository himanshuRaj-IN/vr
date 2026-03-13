import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const App = () => {
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadTransactions = async () => {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/api/transactions`)
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Failed to load')
      setRows(body.rows ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="card">
      <h1>Hello Himanshu</h1>
      <button onClick={loadTransactions}>Load transactions</button>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {rows.length > 0 && (
        <pre style={{ textAlign: 'left', maxHeight: '240px', overflow: 'auto' }}>
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default App