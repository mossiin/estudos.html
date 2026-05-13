const allowed = process.env.CLIENT_URL || '*'

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', allowed)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(res)
    res.status(204).end()
    return true
  }
  return false
}
