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
            <div className="logo-icon">💰</div>
            Personal Finance
          </div>
          <div className="navbar-actions">
            <button
              id="nav-analytics-btn"
              className="icon-btn"
              title="Analytics"
              onClick={() => navigate('/analytics')}
            >
              📊
            </button>
            <button
              id="nav-settings-btn"
              className="icon-btn"
              title="Settings"
              onClick={() => navigate('/settings')}
            >
              ⚙️
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <div className="page">
          <div className="page-heading">
            <h1>Dashboard</h1>
          </div>

          {/* Envelop Jars */}
          <EnvelopJars />
        </div>
      </div>
    </AuthGate>
  )
}

export default Dashboard
