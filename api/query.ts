import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

const isAllowedQuery = (query: string) => {
  const trimmed = query.trim().toUpperCase()
  return [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
  ].some((prefix) => trimmed.startsWith(prefix))
}

export default async function handler(req: any, res: any) {
  const method = req.method

  if (method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST only' })
    return
  }

  const { query } = req.body ?? {}
  if (!query || typeof query !== 'string') {
    res.status(400).json({ ok: false, error: 'Missing query string' })
    return
  }

  if (!isAllowedQuery(query)) {
    res.status(400).json({ ok: false, error: 'Only SELECT/INSERT/UPDATE/DELETE supported' })
    return
  }

  try {
    const result = await sql.transaction((tx: any) => {
      return [tx(query)]
    })

    res.status(200).json({ ok: true, result })
  } catch (error) {
    console.error('Query error', error)
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
