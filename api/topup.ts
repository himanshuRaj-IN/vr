import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// POST /api/topup
// Body: { target_source_name, from_source_name, amount, name, transaction_date }
//
// Bank-style atomic transfer:
//   Step 1: Validate both balances (pre-flight, outside transaction)
//   Step 2: DEBIT account first, then CREDIT target — inside ONE db transaction
//   Step 3: If either INSERT fails → entire transaction rolls back automatically

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
    // ── Pre-flight: get latest balances (before we touch anything) ──────────
    const targetRows = await sql`
      SELECT closing_balance FROM transactions
      WHERE source_name = ${target_source_name}
      ORDER BY id DESC LIMIT 1
    `
    const fromRows = await sql`
      SELECT closing_balance FROM transactions
      WHERE source_name = ${from_source_name}
      ORDER BY id DESC LIMIT 1
    `

    const targetPrev = parseFloat(targetRows[0]?.closing_balance ?? '0')
    const fromPrev   = parseFloat(fromRows[0]?.closing_balance   ?? '0')

    // ── Validate funds before touching anything ──────────────────────────────
    if (fromPrev < amt) {
      return res.status(400).json({
        ok: false,
        error: `Insufficient balance in "${from_source_name}". Available: ₹${fromPrev.toFixed(2)}`,
      })
    }

    const txName = name || ''

    // ── Atomic DB transaction: DEDUCT first, then CREDIT ────────────────────
    // If the credit INSERT fails for any reason, the debit is auto-rolled back.
    // Neither row will exist in the DB unless BOTH succeed.
    const [debitResult, creditResult] = await sql.transaction([
      // 1. Deduct from account envelop first
      sql`
        INSERT INTO transactions (created_at, transaction_date, source_name, amount, closing_balance, name)
        VALUES (NOW(), ${transaction_date}, ${from_source_name}, ${-amt}, ${fromPrev - amt}, ${txName})
        RETURNING *
      `,
      // 2. Credit target envelop
      sql`
        INSERT INTO transactions (created_at, transaction_date, source_name, amount, closing_balance, name)
        VALUES (NOW(), ${transaction_date}, ${target_source_name}, ${amt}, ${targetPrev + amt}, ${txName})
        RETURNING *
      `,
    ])

    return res.status(201).json({
      ok: true,
      message: `Transferred ₹${amt} from "${from_source_name}" → "${target_source_name}"`,
      debit:  debitResult[0],
      credit: creditResult[0],
    })

  } catch (error) {
    // Gets here if:
    //   - DB transaction rolled back (both inserts undone)
    //   - Network/connection error
    console.error('Topup API error — transaction rolled back', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
