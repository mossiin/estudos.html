import { supabase } from '../lib/supabase.js'
import { setCors, handleOptions } from '../lib/cors.js'

// GET /api/concursos?status=aberto&uf=RS
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  setCors(res)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { status, uf, limit = 50 } = req.query
  const VALID_STATUS = ['aberto', 'previsto', 'encerrado']

  let query = supabase
    .from('concursos')
    .select('id, orgao, vagas, status, uf, banca, inscricao_ate, edital_url, fonte, updated_at')
    .order('inscricao_ate', { ascending: true })
    .limit(Math.min(Number(limit) || 50, 200))

  if (status && VALID_STATUS.includes(status)) query = query.eq('status', status)
  if (uf && /^[A-Z]{2}$/.test(uf)) query = query.eq('uf', uf)

  const { data, error } = await query

  if (error) {
    console.error('concursos query error:', error.message)
    return res.status(500).json({ error: 'Erro ao buscar concursos' })
  }

  return res.status(200).json({ data, total: data.length })
}
