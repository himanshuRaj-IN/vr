import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      if (id) {
        const rows = await sql`SELECT * FROM envelops WHERE id = ${id}`
        return res.status(200).json({ ok: true, data: rows[0] })
      } else {
        const rows = await sql`SELECT * FROM envelops ORDER BY id ASC`
        return res.status(200).json({ ok: true, data: rows })
      }
    }

    if (req.method === 'POST') {
      const { source_name, type, is_active } = req.body || {};
      if (!source_name || !type) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: source_name, type' });
      }
      // true is fallback default if is_active not provided
      const activeStatus = is_active !== undefined ? is_active : true;
      const rows = await sql`
        INSERT INTO envelops (source_name, type, is_active) 
        VALUES (${source_name}, ${type}, ${activeStatus}) 
        RETURNING *
      `
      return res.status(201).json({ ok: true, data: rows[0] })
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ ok: false, error: 'id query parameter is required' });
      const { source_name, type, is_active } = req.body || {};
      const rows = await sql`
        UPDATE envelops 
        SET 
          source_name = COALESCE(${source_name ?? null}, source_name),
          type = COALESCE(${type ?? null}, type),
          is_active = COALESCE(${is_active ?? null}, is_active)
        WHERE id = ${id} RETURNING *
      `
      return res.status(200).json({ ok: true, data: rows[0] })
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ ok: false, error: 'id query parameter is required' });
      await sql`DELETE FROM envelops WHERE id = ${id}`
      return res.status(200).json({ ok: true, message: `Deleted envelop ${id}` })
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  } catch (error) {
    console.error('API Error', error);
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
