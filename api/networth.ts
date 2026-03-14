import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' })

  try {
    const days = parseInt(req.query.days ?? '90', 10) // 0 = all time

    // Step 1: Get all active envelope names + types
    const envelops = await sql`
      SELECT source_name, type FROM envelops WHERE is_active = true
    `
    const signMap: Record<string, number> = {}
    for (const e of envelops) {
      signMap[e.source_name] = e.type === 'Owe' ? -1 : 1
    }

    // Step 2: Get transactions (all time or last N days)
    const txns = days > 0
      ? await sql`
          SELECT
            t.id,
            t.transaction_date::text AS date,
            t.source_name,
            t.name,
            t.amount,
            t.closing_balance,
            e.type AS envelope_type
          FROM transactions t
          JOIN envelops e ON e.source_name = t.source_name AND e.is_active = true
          WHERE t.transaction_date >= CURRENT_DATE - (${days} || ' days')::interval
          ORDER BY t.id ASC
        `
      : await sql`
          SELECT
            t.id,
            t.transaction_date::text AS date,
            t.source_name,
            t.name,
            t.amount,
            t.closing_balance,
            e.type AS envelope_type
          FROM transactions t
          JOIN envelops e ON e.source_name = t.source_name AND e.is_active = true
          ORDER BY t.id ASC
        `

    // Step 3: Group by date, compute running net worth
    const byDate: Record<string, any[]> = {}
    for (const txn of txns) {
      if (!byDate[txn.date]) byDate[txn.date] = []
      byDate[txn.date].push(txn)
    }

    const latestBal: Record<string, { balance: number; type: string }> = {}
    const result = []

    for (const date of Object.keys(byDate).sort()) {
      const dayTxns = byDate[date]
      for (const txn of dayTxns) {
        latestBal[txn.source_name] = {
          balance: parseFloat(txn.closing_balance || '0'),
          type: txn.envelope_type,
        }
      }

      // Compute net worth grouped by type (so frontend can toggle types)
      const byType: Record<string, number> = {}
      for (const [, { balance, type }] of Object.entries(latestBal)) {
        byType[type] = (byType[type] || 0) + balance
      }

      result.push({
        date,
        by_type: byType,
        transactions: dayTxns.map(t => ({
          source_name:   t.source_name,
          txn_name:      t.name,
          amount:        parseFloat(t.amount),
          envelope_type: t.envelope_type,
        }))
      })
    }

    return res.status(200).json({ ok: true, data: result })
  } catch (error) {
    console.error('Net Worth History Error', error)
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
