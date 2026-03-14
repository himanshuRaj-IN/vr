import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'GET only' })
  }

  try {
    const rows = await sql`
      SELECT
        e.id,
        e.source_name,
        e.type,
        e.timeframe,
        e.target_amount,
        e.target_date,
        t.closing_balance  AS last_balance,
        t.transaction_date AS last_date,
        s.topup_total,
        s.expense_total,
        h.balance_history
      FROM envelops e
      LEFT JOIN LATERAL (
        SELECT closing_balance, transaction_date
        FROM transactions
        WHERE source_name = e.source_name
        ORDER BY transaction_date DESC, id DESC
        LIMIT 1
      ) t ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount      ELSE 0 END), 0) AS topup_total,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS expense_total
        FROM transactions
        WHERE source_name = e.source_name
          AND e.timeframe IS NOT NULL
          AND transaction_date >= CURRENT_DATE - (e.timeframe || ' days')::INTERVAL
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(h.closing_balance ORDER BY h.transaction_date ASC, h.id ASC) AS balance_history
        FROM (
          SELECT closing_balance, transaction_date, id
          FROM transactions
          WHERE source_name = e.source_name
          ORDER BY transaction_date DESC, id DESC
          LIMIT 12
        ) h
      ) h ON true
      WHERE e.is_active = true
      ORDER BY e.type, e.source_name
    `

    const accounts = await sql`
      SELECT id, source_name
      FROM envelops
      WHERE is_active = true AND type = 'Account'
      ORDER BY source_name
    `

    return res.status(200).json({ ok: true, data: rows, accounts })
  } catch (error) {
    console.error('Dashboard API error', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
