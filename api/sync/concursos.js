import https from 'https'
import { supabase } from '../../lib/supabase.js'

// Chamado pelo Vercel Cron a cada 6 horas.
// Também pode ser chamado manualmente com o header Authorization: Bearer CRON_SECRET
export default async function handler(req, res) {
  const secret = req.headers.authorization?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  try {
    // Estratégia Concursos tem feed RSS de concursos abertos
    const items = await fetchRss('www.estrategiaconcursos.com.br',
      '/blog/feed/?cat=concursos-abertos')

    if (!items.length) {
      return res.status(200).json({ message: 'RSS sem itens novos', inserted: 0 })
    }

    const rows = items.map(item => ({
      orgao:        extrairOrgao(item.title),
      vagas:        extrairVagas(item.title + ' ' + item.description),
      status:       'previsto',
      uf:           extrairUF(item.title + ' ' + item.description),
      banca:        extrairBanca(item.title + ' ' + item.description),
      inscricao_ate: null,
      edital_url:   item.link,
      fonte:        'Estratégia Concursos',
      updated_at:   new Date().toISOString()
    }))

    const { error, count } = await supabase
      .from('concursos')
      .upsert(rows, { onConflict: 'edital_url', ignoreDuplicates: true })
      .select('id')

    if (error) throw error

    return res.status(200).json({ message: 'Sync concluído', inserted: count ?? rows.length })
  } catch (err) {
    console.error('sync/concursos error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

function extrairOrgao(titulo) {
  // Pega o nome antes de traço, vírgula ou parêntese, limitado a 100 chars
  return titulo.replace(/concurso\s+/i, '').split(/[-–,|(]/)[0].trim().slice(0, 100)
}

function extrairVagas(texto) {
  const m = texto.match(/(\d[\d.,]*)\s*vaga/i)
  if (!m) return null
  return parseInt(m[1].replace(/[.,]/g, ''), 10) || null
}

function extrairUF(texto) {
  const ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
    'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
  const m = texto.match(new RegExp(`\\b(${ufs.join('|')})\\b`))
  return m ? m[1] : 'BR'
}

function extrairBanca(texto) {
  const t = texto.toLowerCase()
  if (/cespe|cebraspe/.test(t)) return 'cespe'
  if (/fundatec/.test(t)) return 'fundatec'
  if (/\bfcc\b/.test(t)) return 'fcc'
  if (/\bfgv\b/.test(t)) return 'fgv'
  if (/vunesp/.test(t)) return 'vunesp'
  return 'nao-informada'
}

function fetchRss(host, path) {
  return new Promise((resolve, reject) => {
    const options = { hostname: host, path, headers: { 'User-Agent': 'estudos-html/1.0' } }
    https.get(options, res => {
      if (res.statusCode >= 400) return resolve([])
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
      link:        extractTag(block, 'link')
    })
  }
  return items
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}
