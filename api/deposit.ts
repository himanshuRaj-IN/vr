import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// POST /api/deposit
// Body: { source_name, amount, name, transaction_date }
//
// Used for Account type envelops.
// Handles:
//   +ve amount → salary, cash deposit, opening balance, positive adjustment
//   -ve amount → negative adjustment (correcting balance downward)
// Creates a single transaction. No deduction from any other envelop.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' })
  }

  const { source_name, amount, name, transaction_date } = req.body || {}

  if (!source_name || amount === undefined || !transaction_date) {
    return res.status(400).json({
      ok: false,
      error: 'Required: source_name, amount, transaction_date',
    })
  }

  const amt = parseFloat(amount)
  if (isNaN(amt) || amt === 0) {
    return res.status(400).json({
      ok: false,
      error: 'amount must be a non-zero number (positive to credit, negative to adjust down)',
    })
  }

  try {
    // Get current balance of this account envelop
    const [latest] = await sql`
      SELECT closing_balance
      FROM transactions
      WHERE source_name = ${source_name}
      ORDER BY transaction_date DESC, id DESC
      LIMIT 1
    `

    const prevBalance = parseFloat(latest?.closing_balance ?? '0')
    const newBalance  = prevBalance + amt   // works for both +ve and -ve

    const [tx] = await sql`
      INSERT INTO transactions (created_at, transaction_date, source_name, amount, closing_balance, name)
      VALUES (NOW(), ${transaction_date}, ${source_name}, ${amt}, ${newBalance}, ${name || ''})
      RETURNING *
    `

    return res.status(201).json({
      ok: true,
      message: `${amt > 0 ? 'Deposited' : 'Adjusted'} ₹${Math.abs(amt)} ${amt > 0 ? 'into' : 'from'} "${source_name}". New balance: ₹${newBalance}`,
      transaction: tx,
    })
  } catch (error) {
    console.error('Deposit API error', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
