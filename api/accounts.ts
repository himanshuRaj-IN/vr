import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      if (id) {
        const rows = await sql`SELECT * FROM account WHERE id = ${id}`
        return res.status(200).json({ ok: true, data: rows[0] })
      } else {
        const rows = await sql`SELECT * FROM account ORDER BY id ASC`
        return res.status(200).json({ ok: true, data: rows })
      }
    }

    if (req.method === 'POST') {
      const { account_name, balance } = req.body || {};
      if (!account_name || balance === undefined) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: account_name, balance' });
      }
      const rows = await sql`INSERT INTO account (account_name, balance) VALUES (${account_name}, ${balance}) RETURNING *`
      return res.status(201).json({ ok: true, data: rows[0] })
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ ok: false, error: 'id query parameter is required' });
      const { account_name, balance } = req.body || {};
      const rows = await sql`
        UPDATE account 
        SET 
          account_name = COALESCE(${account_name ?? null}, account_name),
          balance = COALESCE(${balance ?? null}, balance)
        WHERE id = ${id} RETURNING *
      `
      return res.status(200).json({ ok: true, data: rows[0] })
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ ok: false, error: 'id query parameter is required' });
      await sql`DELETE FROM account WHERE id = ${id}`
      return res.status(200).json({ ok: true, message: `Deleted account ${id}` })
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  } catch (error) {
    console.error('API Error', error);
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
