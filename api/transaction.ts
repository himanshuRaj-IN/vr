import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export default async function handler(req: any, res: any) {
  // Extract transaction ID from query parameters (e.g., /api/transaction?id=5)
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ ok: false, error: 'Transaction ID is required in the query parameters (e.g., ?id=1)' });
  }

  // Handle DELETE method
  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM transactions WHERE id = ${id}`
      return res.status(200).json({ ok: true, message: `Transaction ${id} deleted successfully` })
    } catch (error) {
      console.error('DB delete error', error)
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  // Handle UPDATE (PUT) method
  if (req.method === 'PUT') {
    try {
      // WARNING: You must adapt these column names to exactly match your Postgres database schema!
      // Here we assume common columns. Using 'null' fallback allows COALESCE to keep existing values.
      const amount = req.body.amount !== undefined ? req.body.amount : null;
      const description = req.body.description !== undefined ? req.body.description : null;
      const category = req.body.category !== undefined ? req.body.category : null;
      // ... extract any other fields as needed

      await sql`
        UPDATE transactions 
        SET 
          amount = COALESCE(${amount}, amount),
          description = COALESCE(${description}, description),
          category = COALESCE(${category}, category)
        WHERE id = ${id}
      `
      return res.status(200).json({ ok: true, message: `Transaction ${id} updated successfully` })
    } catch (error) {
      console.error('DB update error', error)
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  res.status(405).json({ ok: false, error: 'Method Not Allowed. Use DELETE or PUT.' })
}
