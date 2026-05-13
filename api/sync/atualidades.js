import https from 'https'
import { supabase } from '../../lib/supabase.js'

// Chamado pelo Vercel Cron a cada hora.
// Também pode ser chamado manualmente com o header Authorization: Bearer CRON_SECRET
export default async function handler(req, res) {
  const secret = req.headers.authorization?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  try {
    const items = await fetchRss('agenciabrasil.ebc.com.br',
      '/rss/ultimasnoticias/feed.xml')

    if (!items.length) {
      return res.status(200).json({ message: 'RSS sem itens novos', inserted: 0 })
    }

    // upsert por URL para evitar duplicatas
    const rows = items.map(item => ({
      titulo: item.title.slice(0, 255),
      resumo: item.description?.slice(0, 1000) || '',
      categoria: categorizar(item.title + ' ' + (item.description || '')),
      fonte: 'Agência Brasil',
      url: item.link,
      publicado_em: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
    }))

    const { error, count } = await supabase
      .from('atualidades')
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
      .select('id')

    if (error) throw error

    // mantém apenas os últimos 200 registros
    await supabase.rpc('trim_atualidades', { keep: 200 })

    return res.status(200).json({ message: 'Sync concluído', inserted: count ?? rows.length })
  } catch (err) {
    console.error('sync/atualidades error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// Classifica o texto em categorias usadas pelo guia
function categorizar(texto) {
  const t = texto.toLowerCase()
  if (/concurso|edital|vaga|servidor|aprovad/.test(t)) return 'concursos'
  if (/intelig.ncia artificial|tecnologia|lgpd|5g|cibern/.test(t)) return 'tecnologia'
  if (/economia|pib|inflação|ipca|selic|desemprego|receita/.test(t)) return 'economia'
  if (/saúde|vacin|pandemia|sus|anvisa/.test(t)) return 'saude'
  if (/meio ambiente|clima|queimad|bioma|amazônia/.test(t)) return 'meio-ambiente'
  if (/eleição|partido|congresso|presidente|ministro|câmara|senado/.test(t)) return 'politica'
  return 'geral'
}

// Busca e parseia RSS sem dependência externa
function fetchRss(host, path) {
  return new Promise((resolve, reject) => {
    const options = { hostname: host, path, headers: { 'User-Agent': 'estudos-html/1.0' } }
    https.get(options, res => {
      let xml = ''
      res.on('data', chunk => { xml += chunk })
      res.on('end', () => resolve(parseRss(xml)))
    }).on('error', reject)
  })
}

function parseRss(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    items.push({
      title:       extractTag(block, 'title'),
      description: extractTag(block, 'description'),
      link:        extractTag(block, 'link'),
      pubDate:     extractTag(block, 'pubDate')
    })
  }
  return items
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}
