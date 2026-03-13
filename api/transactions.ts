import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    const page = Number(req.query.page ?? 1)
    const limit = Number(req.query.limit ?? 20)
    const offset = (Math.max(page, 1) - 1) * limit

    try {
      const [rows] = await sql`
        SELECT * FROM transactions
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `

      const [{ count }] = await sql`
        SELECT COUNT(*)::int AS count FROM transactions
      `

      res.status(200).json({ ok: true, rows, count })
    } catch (error) {
      console.error('DB query error', error)
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }

    return
  }

  if (req.method === 'POST') {
    const { transaction_date, source_name, amount, closing_balance } = req.body ?? {}

    if (!transaction_date || !source_name || amount === undefined || closing_balance === undefined) {
      res.status(400).json({ ok: false, error: 'Missing required fields' })
      return
    }

    try {
      const [row] = await sql`
        INSERT INTO transactions (transaction_date, source_name, amount, closing_balance)
        VALUES (${transaction_date}, ${source_name}, ${amount}, ${closing_balance})
        RETURNING *
      `
      res.status(201).json({ ok: true, row })
    } catch (error) {
      console.error('DB insert error', error)
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }

    return
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' })
}
