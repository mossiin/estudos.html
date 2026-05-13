import { supabase } from '../lib/supabase.js'
import { setCors, handleOptions } from '../lib/cors.js'

// GET /api/atualidades?limit=20&categoria=politica
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  setCors(res)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { limit = 20, categoria } = req.query
  const VALID_CATEGORIAS = ['politica', 'economia', 'tecnologia', 'saude', 'meio-ambiente',
    'concursos', 'geral']

  let query = supabase
    .from('atualidades')
    .select('id, titulo, resumo, categoria, fonte, url, publicado_em, created_at')
    .order('publicado_em', { ascending: false })
    .limit(Math.min(Number(limit) || 20, 100))

  if (categoria && VALID_CATEGORIAS.includes(categoria)) query = query.eq('categoria', categoria)

  const { data, error } = await query

  if (error) {
    console.error('atualidades query error:', error.message)
    return res.status(500).json({ error: 'Erro ao buscar atualidades' })
  }

  return res.status(200).json({ data, total: data.length })
}
