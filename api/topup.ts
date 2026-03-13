import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// POST /api/topup
// Body: { target_source_name, from_source_name, amount, name, transaction_date }
//
// Creates 2 transactions atomically:
//   1. target envelop  → closing_balance + amount  (positive)
//   2. account envelop → closing_balance - amount  (negative)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' })
  }

  const { target_source_name, from_source_name, amount, name, transaction_date } = req.body || {}

  if (!target_source_name || !from_source_name || !amount || !transaction_date) {
    return res.status(400).json({
      ok: false,
      error: 'Required: target_source_name, from_source_name, amount, transaction_date',
    })
  }

  const amt = parseFloat(amount)
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ ok: false, error: 'amount must be a positive number' })
  }

  try {
    // Get latest closing_balance for BOTH envelops in one query
    const [balances] = await sql`
      SELECT
        MAX(CASE WHEN source_name = ${target_source_name} THEN closing_balance END) AS target_balance,
        MAX(CASE WHEN source_name = ${from_source_name}   THEN closing_balance END) AS from_balance
      FROM (
        SELECT DISTINCT ON (source_name) source_name, closing_balance
        FROM transactions
        WHERE source_name IN (${target_source_name}, ${from_source_name})
        ORDER BY source_name, transaction_date DESC, id DESC
      ) latest
    `

    const targetPrev = parseFloat(balances.target_balance ?? '0')
    const fromPrev   = parseFloat(balances.from_balance   ?? '0')

    if (fromPrev < amt) {
      return res.status(400).json({ ok: false, error: `Insufficient balance in "${from_source_name}". Available: ${fromPrev}` })
    }

    const today = transaction_date
    const txName = name || ''

    // Insert both transactions
    const [t1, t2] = await Promise.all([
      // Credit target envelop
      sql`
        INSERT INTO transactions (created_at, transaction_date, source_name, amount, closing_balance, name)
        VALUES (NOW(), ${today}, ${target_source_name}, ${amt}, ${targetPrev + amt}, ${txName})
        RETURNING *
      `,
      // Debit account envelop
      sql`
        INSERT INTO transactions (created_at, transaction_date, source_name, amount, closing_balance, name)
        VALUES (NOW(), ${today}, ${from_source_name}, ${-amt}, ${fromPrev - amt}, ${txName})
        RETURNING *
      `,
    ])

    return res.status(201).json({
      ok: true,
      message: `Topped up "${target_source_name}" with ₹${amt} from "${from_source_name}"`,
      transactions: [t1[0], t2[0]],
    })
  } catch (error) {
    console.error('Topup API error', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
