import { useState } from 'react'
import sql from './lib/db'

const App = () => {
  const [data, setData] = useState<any[]>([])

  const testConnection = async () => {
    try {
      const result = await sql`SELECT 1 as test`
      setData(result)
      console.log('DB connected:', result)
    } catch (error) {
      console.error('DB error:', error)
    }
  }

  return (
    <div className="card">
      <h1>Hello Himanshu</h1>
      <button onClick={testConnection}>Test DB Connection</button>
      {data.length > 0 && <p>DB Response: {JSON.stringify(data)}</p>}
    </div>
  )
}

export default App