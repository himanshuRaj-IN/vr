import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// POST /api/expense
// Body: { source_name, amount, name, transaction_date }
//
// Creates 1 transaction: closing_balance - amount (negative amount)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' })
  }

  const { source_name, amount, name, transaction_date } = req.body || {}

  if (!source_name || !amount || !transaction_date) {
    return res.status(400).json({
      ok: false,
      error: 'Required: source_name, amount, transaction_date',
    })
  }

  const amt = parseFloat(amount)
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ ok: false, error: 'amount must be a positive number' })
  }

  try {
    // Get latest closing_balance for this envelop
    const [latest] = await sql`
      SELECT closing_balance
      FROM transactions
      WHERE source_name = ${source_name}
      ORDER BY transaction_date DESC, id DESC
      LIMIT 1
    `

    const prevBalance = parseFloat(latest?.closing_balance ?? '0')

    if (prevBalance < amt) {
      return res.status(400).json({
        ok: false,
        error: `Insufficient balance in "${source_name}". Available: ₹${prevBalance}`,
      })
    }

    const [tx] = await sql`
      INSERT INTO transactions (created_at, transaction_date, source_name, amount, closing_balance, name)
      VALUES (NOW(), ${transaction_date}, ${source_name}, ${-amt}, ${prevBalance - amt}, ${name || ''})
      RETURNING *
    `

    return res.status(201).json({
      ok: true,
      message: `Expense of ₹${amt} recorded for "${source_name}"`,
      transaction: tx,
    })
  } catch (error) {
    console.error('Expense API error', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
