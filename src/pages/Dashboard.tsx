import { useNavigate } from 'react-router-dom'
import AuthGate from '../components/AuthGate'
import EnvelopJars from '../components/EnvelopJars'

const Dashboard = () => {
  const navigate = useNavigate()

  return (
    <AuthGate>
      <div>
        {/* Navbar */}
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="logo-icon" style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </div>
            Onyx
          </div>
          <div className="navbar-actions">
            {/* Action buttons removed */}
          </div>
        </nav>

        {/* Main Content */}
        <div className="page" style={{ paddingTop: '16px' }}>
          {/* Envelop Jars */}
          <EnvelopJars />
        </div>
      </div>
    </AuthGate>
  )
}

export default Dashboard
