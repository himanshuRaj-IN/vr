import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'GET only' })
  }

  try {
    // Single query: fetch all active envelops + their latest transaction's
    // closing_balance via a LATERAL JOIN. One DB round-trip regardless of
    // how many envelops exist.
    const rows = await sql`
      SELECT
        e.id,
        e.source_name,
        e.type,
        t.closing_balance  AS last_balance,
        t.transaction_date AS last_date
      FROM envelops e
      LEFT JOIN LATERAL (
        SELECT closing_balance, transaction_date
        FROM transactions
        WHERE source_name = e.source_name
        ORDER BY transaction_date DESC, id DESC
        LIMIT 1
      ) t ON true
      WHERE e.is_active = true
      ORDER BY e.type, e.source_name
    `
    return res.status(200).json({ ok: true, data: rows })
  } catch (error) {
    console.error('Dashboard API error', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
