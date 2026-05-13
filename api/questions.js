import { supabase } from '../lib/supabase.js'
import { setCors, handleOptions } from '../lib/cors.js'

// GET /api/questions?subject=portugues&banca=fundatec&difficulty=easy&limit=10
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  setCors(res)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { subject, banca, difficulty, limit = 20 } = req.query

  const VALID_SUBJECTS = ['portugues', 'matematica', 'informatica', 'constitucional',
    'administrativo', 'geografia', 'historia', 'atualidades', 'ciencias']
  const VALID_BANCAS = ['cespe', 'cebraspe', 'fcc', 'fgv', 'vunesp', 'fundatec', 'geral']
  const VALID_DIFFICULTIES = ['facil', 'medio', 'dificil']

  let query = supabase
    .from('questions')
    .select('id, subject, banca, difficulty, question, options, answer, explanation, source, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limit) || 20, 100))

  if (subject && VALID_SUBJECTS.includes(subject)) query = query.eq('subject', subject)
  if (banca && VALID_BANCAS.includes(banca)) query = query.eq('banca', banca)
  if (difficulty && VALID_DIFFICULTIES.includes(difficulty)) query = query.eq('difficulty', difficulty)

  const { data, error } = await query

  if (error) {
    console.error('questions query error:', error.message)
    return res.status(500).json({ error: 'Erro ao buscar questões' })
  }

  return res.status(200).json({ data, total: data.length })
}
