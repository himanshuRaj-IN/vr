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
      const { source_name, type, is_active, timeframe, target_amount, target_date } = req.body || {};
      if (!source_name || !type) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: source_name, type' });
      }
      const activeStatus = is_active !== undefined ? is_active : true;
      const tf = timeframe != null && timeframe !== '' ? parseInt(timeframe) : null;
      const amt = target_amount != null && target_amount !== '' ? parseFloat(target_amount) : null;
      const rows = await sql`
        INSERT INTO envelops (source_name, type, is_active, timeframe, target_amount, target_date)
        VALUES (${source_name}, ${type}, ${activeStatus}, ${tf}, ${amt}, ${target_date || null})
        RETURNING *
      `
      return res.status(201).json({ ok: true, data: rows[0] })
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ ok: false, error: 'id query parameter is required' });
      const { source_name, type, is_active, timeframe, target_amount, target_date } = req.body || {};
      const tf = timeframe != null && timeframe !== '' ? parseInt(timeframe) : null;
      const amt = target_amount != null && target_amount !== '' ? parseFloat(target_amount) : null;
      const rows = await sql`
        UPDATE envelops
        SET
          source_name = COALESCE(${source_name ?? null}, source_name),
          type        = COALESCE(${type       ?? null}, type),
          is_active   = COALESCE(${is_active  ?? null}, is_active),
          timeframe   = COALESCE(${tf}, timeframe),
          target_amount = COALESCE(${amt}, target_amount),
          target_date   = COALESCE(${target_date ?? null}, target_date)
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
