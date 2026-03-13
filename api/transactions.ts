import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      // Fetch data from the transactions table, limited to 100 rows
      const rows = await sql`SELECT * FROM transactions ORDER BY id DESC LIMIT 100`
      res.status(200).json({ ok: true, rows })
    } catch (error) {
      console.error('DB query error', error)
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  res.status(405).json({ ok: false, error: 'Method Not Allowed' })
}
