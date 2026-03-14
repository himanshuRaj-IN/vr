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
      const { source_name, type, is_active, timeframe, default_budget } = req.body || {};
      if (!source_name || !type) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: source_name, type' });
      }
      const activeStatus = is_active !== undefined ? is_active : true;
      const tf = timeframe != null && timeframe !== '' ? parseInt(timeframe) : null;
      const budget = default_budget != null && default_budget !== '' ? parseFloat(default_budget) : null;
      const rows = await sql`
        INSERT INTO envelops (source_name, type, is_active, timeframe, default_budget)
        VALUES (${source_name}, ${type}, ${activeStatus}, ${tf}, ${budget})
        RETURNING *
      `
      return res.status(201).json({ ok: true, data: rows[0] })
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ ok: false, error: 'id query parameter is required' });
      const { source_name, type, is_active, timeframe, default_budget } = req.body || {};
      const tf = timeframe != null && timeframe !== '' ? parseInt(timeframe) : null;
      const budget = default_budget != null && default_budget !== '' ? parseFloat(default_budget) : null;
      const rows = await sql`
        UPDATE envelops
        SET
          source_name = COALESCE(${source_name ?? null}, source_name),
          type        = COALESCE(${type       ?? null}, type),
          is_active   = COALESCE(${is_active  ?? null}, is_active),
          timeframe   = COALESCE(${tf}, timeframe),
          default_budget = COALESCE(${budget}, default_budget)
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
