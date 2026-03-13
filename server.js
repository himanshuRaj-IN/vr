import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { neon } from '@neondatabase/serverless'

// Load environment variables from .env.local (Vercel) first, then fall back to .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const app = express()
app.use(cors())
app.use(express.json())

const port = process.env.PORT ? Number(process.env.PORT) : 3001

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

app.get('/api/transactions', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM transactions LIMIT 20`
    res.json({ ok: true, rows })
  } catch (error) {
    console.error('Query error:', error)
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' })
})

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
