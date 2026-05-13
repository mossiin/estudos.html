-- ============================================================
-- estudos.html — Schema do banco Supabase
-- Rodar no SQL Editor do Supabase: app.supabase.com → SQL Editor
-- ============================================================

-- ── TABELA: questions ──────────────────────────────────────────
-- Questões de concurso por matéria e banca, curadas manualmente ou por IA
CREATE TABLE IF NOT EXISTS questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      VARCHAR(30)  NOT NULL,   -- portugues | matematica | informatica | constitucional | administrativo | geografia | historia | atualidades | ciencias
  banca        VARCHAR(20)  NOT NULL,   -- cespe | cebraspe | fcc | fgv | vunesp | fundatec | geral
  difficulty   VARCHAR(10)  NOT NULL,   -- facil | medio | dificil
  question     TEXT         NOT NULL,
  options      JSONB        NOT NULL,   -- ["opção A", "opção B", "opção C", "opção D"]
  answer       VARCHAR(5)   NOT NULL,   -- "A" | "B" | "C" | "D" | "E"
  explanation  TEXT,
  source       VARCHAR(255),            -- ex: "CESPE 2024 — TRF5"
  created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_subject   ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_banca     ON questions(banca);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- ── TABELA: concursos ──────────────────────────────────────────
-- Editais abertos e previstos, populados pelo cron sync/concursos
CREATE TABLE IF NOT EXISTS concursos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao         VARCHAR(100) NOT NULL,
  vagas         INT,
  status        VARCHAR(20)  NOT NULL DEFAULT 'previsto',  -- aberto | previsto | encerrado
  uf            VARCHAR(2)   NOT NULL DEFAULT 'BR',        -- SP | RS | BR (nacional)
  banca         VARCHAR(30),
  inscricao_ate DATE,
  edital_url    TEXT         UNIQUE,                       -- chave de deduplicação
  fonte         VARCHAR(100),
  updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concursos_status ON concursos(status);
CREATE INDEX IF NOT EXISTS idx_concursos_uf     ON concursos(uf);

-- ── TABELA: atualidades ────────────────────────────────────────
-- Notícias relevantes para concurso, populadas pelo cron sync/atualidades
CREATE TABLE IF NOT EXISTS atualidades (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       VARCHAR(255) NOT NULL,
  resumo       TEXT,
  categoria    VARCHAR(30)  NOT NULL DEFAULT 'geral',  -- politica | economia | tecnologia | saude | meio-ambiente | concursos | geral
  fonte        VARCHAR(100),
  url          TEXT         UNIQUE,                    -- chave de deduplicação
  publicado_em TIMESTAMP    NOT NULL,
  created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atualidades_categoria    ON atualidades(categoria);
CREATE INDEX IF NOT EXISTS idx_atualidades_publicado_em ON atualidades(publicado_em DESC);

-- ── FUNÇÃO: trim_atualidades ────────────────────────────────────
-- Mantém somente os N registros mais recentes (chamada pelo cron)
CREATE OR REPLACE FUNCTION trim_atualidades(keep INT DEFAULT 200)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM atualidades
  WHERE id NOT IN (
    SELECT id FROM atualidades
    ORDER BY publicado_em DESC
    LIMIT keep
  );
END;
$$;

-- ── ROW LEVEL SECURITY ─────────────────────────────────────────
-- Leitura pública (o guia faz GET sem autenticação)
-- Escrita apenas com SERVICE_ROLE_KEY (backend)
ALTER TABLE questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE concursos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE atualidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura publica questions"   ON questions   FOR SELECT USING (true);
CREATE POLICY "leitura publica concursos"   ON concursos   FOR SELECT USING (true);
CREATE POLICY "leitura publica atualidades" ON atualidades FOR SELECT USING (true);

-- Inserts/updates permitidos apenas pelo service role (sem policy = bloqueado para anon)
-- O backend usa SERVICE_ROLE_KEY que bypassa RLS automaticamente.

-- ── SEED INICIAL: algumas questões de exemplo ──────────────────
INSERT INTO questions (subject, banca, difficulty, question, options, answer, explanation, source) VALUES
(
  'portugues', 'cespe', 'facil',
  'A crase está empregada corretamente em qual alternativa?',
  '["Refiro-me à você.", "Fui à pé ao trabalho.", "Cheguei às três horas.", "Assisti à uma peça."]',
  'C',
  '"às três horas" usa crase corretamente (a + as = às). Antes de pronome, palavra masculina ou "uma" não se usa crase.',
  'CESPE — questão adaptada'
),
(
  'matematica', 'geral', 'facil',
  'Quanto é 35% de 240?',
  '["74", "80", "84", "90"]',
  'C',
  '35% de 240 = (240 × 35) / 100 = 8400 / 100 = 84.',
  'Geral'
),
(
  'informatica', 'fundatec', 'medio',
  'No Excel, ao copiar a fórmula =SOMA($A$1:A3) da célula B3 para B4, o resultado será:',
  '["=SOMA($A$1:A3)", "=SOMA($A$1:A4)", "=SOMA($A$2:A4)", "=SOMA(A1:A4)"]',
  'B',
  '$A$1 é referência absoluta (não muda). A3 é relativa (muda para A4 ao copiar para baixo).',
  'FUNDATEC — adaptada'
),
(
  'constitucional', 'cespe', 'facil',
  'Qual remédio constitucional protege a liberdade de locomoção ameaçada por ato ilegal?',
  '["Mandado de Segurança", "Habeas Data", "Habeas Corpus", "Mandado de Injunção"]',
  'C',
  'Habeas Corpus (Art. 5º, LXVIII) protege a liberdade de locomoção.',
  'CF/88 Art. 5º'
),
(
  'administrativo', 'geral', 'facil',
  'Qual modalidade de licitação deve ser usada para aquisição de bens e serviços comuns?',
  '["Concorrência", "Concurso", "Pregão", "Leilão"]',
  'C',
  'Pregão é obrigatório para bens e serviços comuns, preferencialmente na forma eletrônica (Lei 14.133/2021).',
  'Lei 14.133/2021'
);
