import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ApiTester from './pages/ApiTester'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/api/test" element={<ApiTester />} />
    </Routes>
  )
}

export default App