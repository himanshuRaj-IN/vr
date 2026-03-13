import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  try {
    await sql`SELECT 1`
    res.json({ ok: true, env: process.env.NODE_ENV || 'development' })
  } catch (error) {
    res.status(500).json({ ok: false, error: 'DB connection failed' })
  }
}
