import { useState } from 'react'

const ACCESS_CODE = 'farpr'

interface AuthGateProps {
  children: React.ReactNode
}

const AuthGate = ({ children }: AuthGateProps) => {
  const [unlocked, setUnlocked] = useState(() => {
    return sessionStorage.getItem('pf_unlocked') === '1'
  })
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() === ACCESS_CODE) {
      sessionStorage.setItem('pf_unlocked', '1')
      setUnlocked(true)
    } else {
      setError(true)
      setInput('')
      setTimeout(() => setError(false), 1000)
    }
  }

  if (unlocked) return <>{children}</>

  return (
    <div className="auth-wrapper">
      {/* Blurred background content */}
      <div className="blur-content">
        {children}
      </div>

      {/* Auth Overlay */}
      <div className="auth-overlay">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="lock-icon">🔐</div>
          <h2>Personal Finance</h2>
          <p>Enter your access code to continue</p>
          <div className="auth-input-wrap">
            <input
              id="access-code-input"
              className={`auth-input${error ? ' error' : ''}`}
              type="password"
              autoFocus
              placeholder="••••••"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {error && <p className="auth-error">Incorrect code, try again.</p>}
          </div>
          <button id="access-code-submit" className="btn-primary" type="submit">
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}

export default AuthGate
