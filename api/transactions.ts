import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  try {
    const rows = await sql`SELECT * FROM transactions LIMIT 50`
    res.status(200).json({ ok: true, rows })
  } catch (error) {
    console.error('DB query error', error)
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
