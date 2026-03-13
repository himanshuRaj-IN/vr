import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  const { id, limit } = req.query;

  try {
    if (req.method === 'GET') {
      if (id) {
        const rows = await sql`SELECT * FROM transactions WHERE id = ${id}`
        return res.status(200).json({ ok: true, data: rows[0] })
      } else {
        const listLimit = limit ? Number(limit) : 100;
        const rows = await sql`SELECT * FROM transactions ORDER BY created_at DESC LIMIT ${listLimit}`
        return res.status(200).json({ ok: true, data: rows })
      }
    }

    if (req.method === 'POST') {
      const { created_at, transaction_date, source_name, amount, closing_balance } = req.body || {};
      if (!transaction_date || !source_name || amount === undefined || closing_balance === undefined) {
         return res.status(400).json({ ok: false, error: 'Missing required fields: transaction_date, source_name, amount, closing_balance' });
      }
      
      const rows = await sql`
        INSERT INTO transactions (created_at, transaction_date, source_name, amount, closing_balance) 
        VALUES (COALESCE(${created_at ?? null}, NOW()), ${transaction_date}, ${source_name}, ${amount}, ${closing_balance}) 
        RETURNING *
      `
      return res.status(201).json({ ok: true, data: rows[0] })
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ ok: false, error: 'id query parameter is required' });
      const { transaction_date, source_name, amount, closing_balance } = req.body || {};
      const rows = await sql`
        UPDATE transactions 
        SET 
          transaction_date = COALESCE(${transaction_date ?? null}, transaction_date),
          source_name = COALESCE(${source_name ?? null}, source_name),
          amount = COALESCE(${amount ?? null}, amount),
          closing_balance = COALESCE(${closing_balance ?? null}, closing_balance)
        WHERE id = ${id} RETURNING *
      `
      return res.status(200).json({ ok: true, data: rows[0] })
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ ok: false, error: 'id query parameter is required' });
      await sql`DELETE FROM transactions WHERE id = ${id}`
      return res.status(200).json({ ok: true, message: `Deleted transaction ${id}` })
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  } catch (error) {
    console.error('API Error', error);
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
