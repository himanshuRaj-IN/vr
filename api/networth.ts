import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' })

  try {
    // Step 1: Get all active envelope names + types
    const envelops = await sql`
      SELECT source_name, type FROM envelops WHERE is_active = true
    `
    // Build sign map: +1 for assets, -1 for liabilities
    const signMap: Record<string, number> = {}
    for (const e of envelops) {
      signMap[e.source_name] = e.type === 'Owe' ? -1 : 1
    }

    // Step 2: Get last 90 days of transactions
    const txns = await sql`
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
      WHERE t.transaction_date >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY t.transaction_date ASC, t.id ASC
    `

    // Step 3: For each unique date, compute net worth as sum of latest closing balance per envelope
    // Group transactions by date
    const byDate: Record<string, any[]> = {}
    for (const txn of txns) {
      if (!byDate[txn.date]) byDate[txn.date] = []
      byDate[txn.date].push(txn)
    }

    // Track latest closing balance per envelope (running)
    const latestBal: Record<string, number> = {}
    const result = []

    for (const date of Object.keys(byDate).sort()) {
      const dayTxns = byDate[date]
      for (const txn of dayTxns) {
        latestBal[txn.source_name] = parseFloat(txn.closing_balance || '0')
      }

      // Compute net worth from latest balances
      let netWorth = 0
      for (const [name, bal] of Object.entries(latestBal)) {
        netWorth += bal * (signMap[name] ?? 1)
      }

      result.push({
        date,
        net_worth: netWorth,
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
