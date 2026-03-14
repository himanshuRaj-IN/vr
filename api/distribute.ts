import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// POST /api/distribute
// Body: { from_source_name, distributions: [{ target_source_name, amount }], transaction_date, name }
//
// distributions: array of { target_source_name: string, amount: number }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' })
  }

  const { from_source_name, distributions, transaction_date, name } = req.body || {}

  if (!from_source_name || !distributions || !Array.isArray(distributions) || !transaction_date) {
    return res.status(400).json({
      ok: false,
      error: 'Required: from_source_name, distributions (array), transaction_date',
    })
  }

  const txName = name || 'Fund Distribution'
  const totalToDistribute = distributions.reduce((sum, d) => sum + parseFloat(d.amount), 0)

  if (isNaN(totalToDistribute) || totalToDistribute <= 0) {
    return res.status(400).json({ ok: false, error: 'Total distribution amount must be positive' })
  }

  try {
    // 1. Get source balance
    const fromRows = await sql`
      SELECT closing_balance FROM transactions
      WHERE source_name = ${from_source_name}
      ORDER BY transaction_date DESC, id DESC LIMIT 1
    `
    const fromPrev = parseFloat(fromRows[0]?.closing_balance ?? '0')

    if (fromPrev < totalToDistribute) {
      return res.status(400).json({
        ok: false,
        error: `Insufficient balance in "${from_source_name}". Available: ₹${fromPrev.toFixed(2)}, Needed: ₹${totalToDistribute.toFixed(2)}`,
      })
    }

    // 2. Get balances for all targets
    const targetNames = distributions.map(d => d.target_source_name)
    const targetBalancesRows = await sql`
      SELECT source_name, closing_balance 
      FROM (
        SELECT source_name, closing_balance, 
               ROW_NUMBER() OVER (PARTITION BY source_name ORDER BY transaction_date DESC, id DESC) as rn
        FROM transactions
        WHERE source_name = ANY(${targetNames})
      ) t
      WHERE rn = 1
    `
    const targetBalancesMap: Record<string, number> = {}
    targetBalancesRows.forEach(row => {
      targetBalancesMap[row.source_name] = parseFloat(row.closing_balance)
    })

    // 3. Build transaction queries
    const queries = []

    // Debit source
    queries.push(sql`
      INSERT INTO transactions (created_at, transaction_date, source_name, amount, closing_balance, name)
      VALUES (NOW(), ${transaction_date}, ${from_source_name}, ${-totalToDistribute}, ${fromPrev - totalToDistribute}, ${txName})
    `)

    // Credits for each target
    let currentFromBalance = fromPrev
    distributions.forEach(d => {
      const amt = parseFloat(d.amount)
      if (amt <= 0) return
      
      const prevBal = targetBalancesMap[d.target_source_name] || 0
      queries.push(sql`
        INSERT INTO transactions (created_at, transaction_date, source_name, amount, closing_balance, name)
        VALUES (NOW(), ${transaction_date}, ${d.target_source_name}, ${amt}, ${prevBal + amt}, ${txName})
      `)
    })

    await sql.transaction(queries)

    return res.status(201).json({
      ok: true,
      message: `Distributed ₹${totalToDistribute} from "${from_source_name}" to ${distributions.length} targets`,
    })

  } catch (error) {
    console.error('Distribution API error', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
