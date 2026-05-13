# estudos.html — CLAUDE.md

> Leia este arquivo antes de qualquer tarefa neste projeto.
> Ele descreve o que é o projeto, como está estruturado e como trabalhar nele.

---

## O que é este projeto

Backend de API + guia HTML para estudo de concurso público brasileiro.

O `guia.html` é um arquivo HTML self-contained que serve como guia interativo de estudos.
Ele consome esta API para receber:
- **Questões de concurso** atualizadas por matéria e banca
- **Concursos abertos/previstos** com vagas e datas
- **Atualidades** curadas automaticamente via RSS

Se a API estiver offline, o guia funciona normalmente com o conteúdo estático embutido (fallback).

**Dono:** Lucas — estudando para concurso público brasileiro.
**Bancas cobertas:** CESPE/CEBRASPE · FCC · FGV · VUNESP · FUNDATEC

---

## Stack

| Camada | Tecnologia | Por quê |
|--------|-----------|---------|
| API | Node.js serverless (Vercel Functions) | Sem servidor para gerenciar, deploy automático via push |
| Banco | Supabase (PostgreSQL) | Já usado no projeto Koda, client JS fácil, RLS nativo |
| Cron | Vercel Cron Jobs | Grátis no free tier, integrado com as functions |
| Frontend | HTML/CSS/JS vanilla | Self-contained, funciona offline, sem build step |

---

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente
cp .env.example .env
# Preencher SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET

# 3. Criar tabelas no banco (rodar uma única vez)
# Abrir app.supabase.com → SQL Editor → colar conteúdo de scripts/schema.sql

# 4. Iniciar servidor de desenvolvimento
npm run dev
# API disponível em http://localhost:3000/api/...

# 5. Abrir o guia no navegador
# Abrir guia.html diretamente no browser (duplo clique)
# O guia detecta se está em localhost e usa http://localhost:3000 como base da API
```

---

## Estrutura de arquivos

```
estudos.html/
├── api/
│   ├── questions.js         ← GET /api/questions
│   ├── concursos.js         ← GET /api/concursos
│   ├── atualidades.js       ← GET /api/atualidades
│   └── sync/
│       ├── atualidades.js   ← Cron: parseia RSS Agência Brasil (a cada 1h)
│       └── concursos.js     ← Cron: parseia RSS Estratégia Concursos (a cada 6h)
├── lib/
│   ├── supabase.js          ← instância única do client Supabase (SERVICE_ROLE_KEY)
│   └── cors.js              ← helper de CORS e cache headers
├── scripts/
│   └── schema.sql           ← schema completo + seed inicial (rodar no Supabase SQL Editor)
├── guia.html                ← o guia de estudos com fetch da API + fallback offline
├── vercel.json              ← configuração de cron jobs e funções
├── package.json
├── .env.example
├── .gitignore
└── CLAUDE.md                ← este arquivo
```

---

## Endpoints da API

### GET /api/questions

Busca questões do banco. Todos os parâmetros são opcionais.

```
GET /api/questions?subject=portugues&banca=fundatec&difficulty=facil&limit=10
```

| Parâmetro | Valores válidos | Default |
|-----------|----------------|---------|
| subject | portugues, matematica, informatica, constitucional, administrativo, geografia, historia, atualidades, ciencias | todos |
| banca | cespe, cebraspe, fcc, fgv, vunesp, fundatec, geral | todas |
| difficulty | facil, medio, dificil | todas |
| limit | 1–100 | 20 |

**Resposta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "subject": "portugues",
      "banca": "cespe",
      "difficulty": "facil",
      "question": "A crase está correta em...",
      "options": ["opção A", "opção B", "opção C", "opção D"],
      "answer": "C",
      "explanation": "...",
      "source": "CESPE 2023"
    }
  ],
  "total": 1
}
```

---

### GET /api/concursos

Busca concursos abertos e previstos.

```
GET /api/concursos?status=aberto&uf=RS&limit=20
```

| Parâmetro | Valores válidos | Default |
|-----------|----------------|---------|
| status | aberto, previsto, encerrado | todos |
| uf | código de 2 letras (RS, SP, BR...) | todos |
| limit | 1–200 | 50 |

---

### GET /api/atualidades

Busca notícias relevantes para concurso.

```
GET /api/atualidades?categoria=politica&limit=10
```

| Parâmetro | Valores válidos | Default |
|-----------|----------------|---------|
| categoria | politica, economia, tecnologia, saude, meio-ambiente, concursos, geral | todos |
| limit | 1–100 | 20 |

---

### POST /api/sync/atualidades e /api/sync/concursos

Acionados automaticamente pelo Vercel Cron. Para acionar manualmente:

```bash
curl -X GET https://seu-dominio.vercel.app/api/sync/atualidades \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

---

## Banco de dados — tabelas

### questions
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK gerado automaticamente |
| subject | VARCHAR(30) | Matéria (portugues, matematica...) |
| banca | VARCHAR(20) | Banca organizadora |
| difficulty | VARCHAR(10) | facil, medio, dificil |
| question | TEXT | Enunciado da questão |
| options | JSONB | Array de alternativas: ["A", "B", "C", "D"] |
| answer | VARCHAR(5) | Resposta correta: "A", "B", "C" ou "D" |
| explanation | TEXT | Explicação do gabarito |
| source | VARCHAR(255) | Fonte (ex: "CESPE 2023 — TRF5") |

### concursos
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| orgao | VARCHAR(100) | Nome do órgão |
| vagas | INT | Número de vagas (null se não informado) |
| status | VARCHAR(20) | aberto, previsto, encerrado |
| uf | VARCHAR(2) | Estado (RS, SP, BR para nacional) |
| banca | VARCHAR(30) | Banca organizadora |
| inscricao_ate | DATE | Prazo de inscrição |
| edital_url | TEXT UNIQUE | Link do edital (chave de deduplicação) |

### atualidades
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| titulo | VARCHAR(255) | Título da notícia |
| resumo | TEXT | Descrição/resumo |
| categoria | VARCHAR(30) | politica, economia, tecnologia... |
| fonte | VARCHAR(100) | Agência Brasil, etc. |
| url | TEXT UNIQUE | Link original (chave de deduplicação) |
| publicado_em | TIMESTAMP | Data de publicação original |

---

## Como adicionar questões manualmente

**Opção 1 — Direto no Supabase SQL Editor:**

```sql
INSERT INTO questions (subject, banca, difficulty, question, options, answer, explanation, source)
VALUES (
  'portugues', 'cespe', 'facil',
  'Qual alternativa usa a crase corretamente?',
  '["Fui à pé.", "Cheguei às dez horas.", "Refiro-me à você.", "Vou à uma reunião."]',
  'B',
  '"às dez horas" usa crase corretamente. Demais alternativas erram.',
  'CESPE 2024'
);
```

**Opção 2 — Via IA:** peça para uma IA gerar 10 questões de uma matéria no formato JSON e insira em lote.

**Formato para inserção em lote:**
```sql
INSERT INTO questions (subject, banca, difficulty, question, options, answer, explanation, source)
VALUES
  ('matematica', 'fcc', 'medio', 'Questão...', '["A","B","C","D"]', 'A', 'Explicação...', 'FCC 2024'),
  ('matematica', 'fcc', 'medio', 'Questão...', '["A","B","C","D"]', 'C', 'Explicação...', 'FCC 2024');
```

---

## Automação (cron jobs)

| Endpoint | Frequência | O que faz |
|----------|-----------|-----------|
| /api/sync/atualidades | A cada 1h | Busca RSS da Agência Brasil, salva em `atualidades`, mantém últimos 200 |
| /api/sync/concursos | A cada 6h | Busca RSS de Estratégia Concursos, salva em `concursos` |

Os crons são configurados em `vercel.json`. Só funcionam em produção (não em `vercel dev`).

Para testar localmente, faça um GET manual com o header `Authorization: Bearer SEU_CRON_SECRET`.

---

## Deploy

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Fazer login
vercel login

# 3. Configurar variáveis de ambiente no dashboard do Vercel:
#    SUPABASE_URL
#    SUPABASE_SERVICE_ROLE_KEY
#    CRON_SECRET
#    CLIENT_URL=https://seu-dominio.vercel.app

# 4. Deploy
vercel --prod
```

Após o deploy, atualizar a variável `API_BASE` no `guia.html`:
```js
const API_BASE = 'https://seu-projeto.vercel.app'
```

---

## Segurança

| Regra | Onde | Por quê |
|-------|------|---------|
| SERVICE_ROLE_KEY só no backend | lib/supabase.js | Nunca exposta ao browser |
| RLS habilitado nas 3 tabelas | schema.sql | Leitura pública, escrita só pelo service role |
| CRON_SECRET no header Authorization | api/sync/*.js | Evita que qualquer um acione o sync |
| Validação de parâmetros com whitelist | todos os endpoints | Evita SQL injection via query params |
| CORS restrito ao CLIENT_URL | lib/cors.js | Evita uso da API por outros domínios em produção |

---

## Regras invioláveis

1. **SERVICE_ROLE_KEY nunca vai para o frontend** — nem nos headers de fetch do guia.html.
2. **Sempre validar parâmetros com whitelist** antes de enviar ao Supabase — nunca interpolar query strings diretamente.
3. **Upsert por URL** nas tabelas de atualidades e concursos — evita duplicatas no cron.
4. **Fallback offline sempre funciona** — se a API falhar, o guia.html mantém o conteúdo estático.
5. **Não adicionar comentários explicando O QUE o código faz** — apenas comentários do POR QUÊ quando não óbvio.

---

## Bugs conhecidos / limitações

| Item | Detalhe |
|------|---------|
| RSS de concursos impreciso | Estratégia Concursos não tem RSS oficial de editais — o feed pode trazer posts mistos. Filtrar manualmente as entradas ruins no banco se necessário. |
| Vagas extraídas por regex | O campo `vagas` pode vir null para editais que não mencionam o número no título/resumo do RSS. |
| Cron só funciona em produção | Em `vercel dev` os crons não disparam — testar manualmente com curl. |
| Sem autenticação de admin | Inserção de questões é feita diretamente no Supabase SQL Editor. Uma interface admin pode ser adicionada no futuro. |
