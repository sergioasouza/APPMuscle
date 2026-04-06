-- ============================================================
-- GymTracker — Seed normalized system exercise catalog
-- Migration: 20260406_seed_system_exercises_catalog.sql
--
-- Seeds the global catalog consumed by every account.
-- Safe to re-run: system rows are matched by system_key.
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_exercises_system_name_modality_unique;

CREATE TEMP TABLE tmp_system_exercise_seed (
  system_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  modality TEXT,
  muscle_group TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_system_exercise_seed (system_key, name, modality, muscle_group)
VALUES
    -- Peito
    ('supino-reto-barra-livre', 'Supino Reto', 'Barra-Livre', 'Peito'),
    ('supino-reto-halter', 'Supino Reto', 'Halter', 'Peito'),
    ('supino-reto-maquina', 'Supino Reto', 'Máquina', 'Peito'),
    ('supino-reto-smith', 'Supino Reto', 'Smith', 'Peito'),
    ('supino-inclinado-barra-livre', 'Supino Inclinado', 'Barra-Livre', 'Peito'),
    ('supino-inclinado-halter', 'Supino Inclinado', 'Halter', 'Peito'),
    ('supino-inclinado-maquina', 'Supino Inclinado', 'Máquina', 'Peito'),
    ('supino-inclinado-smith', 'Supino Inclinado', 'Smith', 'Peito'),
    ('supino-declinado-barra-livre', 'Supino Declinado', 'Barra-Livre', 'Peito'),
    ('supino-declinado-halter', 'Supino Declinado', 'Halter', 'Peito'),
    ('supino-declinado-maquina', 'Supino Declinado', 'Máquina', 'Peito'),
    ('supino-declinado-smith', 'Supino Declinado', 'Smith', 'Peito'),
    ('crucifixo-peck-deck', 'Crucifixo', 'Máquina (Peck Deck)', 'Peito'),
    ('crucifixo-maquina-anilha', 'Crucifixo', 'Máquina (Anilha)', 'Peito'),
    ('crucifixo-halter', 'Crucifixo', 'Halter', 'Peito'),
    ('crucifixo-inclinado-halter', 'Crucifixo Inclinado', 'Halter', 'Peito'),
    ('crucifixo-na-polia', 'Crucifixo na Polia', 'Cabo', 'Peito'),
    ('crossover-superior', 'Crossover Superior', 'Cabo', 'Peito'),
    ('crossover-inferior', 'Crossover Inferior', 'Cabo', 'Peito'),
    ('pullover-com-halter', 'Pullover com Halter', 'Halter', 'Peito'),
    ('paralela-dips', 'Paralela / Dips', 'Livre', 'Peito'),

    -- Costas
    ('puxada-aberta', 'Puxada Aberta', 'Polia', 'Costas'),
    ('puxada-fechada', 'Puxada Fechada', 'Polia', 'Costas'),
    ('puxada-triangulo', 'Puxada Triângulo', 'Polia', 'Costas'),
    ('puxada-neutra', 'Puxada Neutra', 'Polia', 'Costas'),
    ('pull-down', 'Pull Down', 'Cabo', 'Costas'),
    ('face-pull', 'Face Pull', 'Cabo', 'Costas'),
    ('remada-curvada', 'Remada Curvada', 'Barra-Livre', 'Costas'),
    ('remada-cavalinho', 'Remada Cavalinho', 'Barra-Livre', 'Costas'),
    ('remada-aberta-maquina', 'Remada Aberta', 'Máquina', 'Costas'),
    ('remada-aberta-peito-apoiado', 'Remada Aberta com Peito Apoiado', 'Máquina', 'Costas'),
    ('remada-baixa-triangulo', 'Remada Baixa Triângulo', 'Polia', 'Costas'),
    ('remada-baixa-pegada-aberta', 'Remada Baixa Pegada Aberta', 'Polia', 'Costas'),
    ('remada-baixa-fechada', 'Remada Baixa Fechada', 'Polia', 'Costas'),
    ('remada-unilateral-halter', 'Remada Unilateral', 'Halter', 'Costas'),
    ('remada-unilateral-maquina', 'Remada Unilateral', 'Máquina', 'Costas'),
    ('t-bar', 'T-Bar', 'Máquina', 'Costas'),
    ('pullover-maquina', 'Pullover', 'Máquina', 'Costas'),
    ('barra-fixa', 'Barra Fixa', 'Peso Corporal', 'Costas'),
    ('levantamento-terra', 'Levantamento Terra', 'Barra-Livre', 'Costas'),

    -- Pernas
    ('agachamento-barra-livre', 'Agachamento', 'Barra-Livre', 'Pernas'),
    ('agachamento-smith', 'Agachamento', 'Smith', 'Pernas'),
    ('agachamento-pendulo', 'Agachamento Pêndulo', 'Máquina', 'Pernas'),
    ('agachamento-hack', 'Agachamento Hack', 'Máquina', 'Pernas'),
    ('belt-squat', 'Belt Squat', 'Máquina', 'Pernas'),
    ('leg-press-45', 'Leg Press 45', 'Máquina', 'Pernas'),
    ('leg-press-articulado', 'Leg Press Articulado', 'Máquina', 'Pernas'),
    ('leg-press-horizontal', 'Leg Press Horizontal', 'Máquina', 'Pernas'),
    ('cadeira-extensora', 'Cadeira Extensora', 'Máquina', 'Pernas'),
    ('cadeira-extensora-unilateral', 'Cadeira Extensora Unilateral', 'Máquina', 'Pernas'),
    ('mesa-flexora', 'Mesa Flexora', 'Máquina', 'Pernas'),
    ('cadeira-flexora', 'Cadeira Flexora', 'Máquina', 'Pernas'),
    ('cadeira-flexora-unilateral', 'Cadeira Flexora Unilateral', 'Máquina', 'Pernas'),
    ('stiff-barra-livre', 'Stiff', 'Barra-Livre', 'Pernas'),
    ('stiff-smith', 'Stiff', 'Smith', 'Pernas'),
    ('levantamento-romeno', 'Levantamento Romeno', 'Barra-Livre', 'Pernas'),
    ('agachamento-bulgaro-barra-livre', 'Agachamento Búlgaro', 'Barra-Livre', 'Pernas'),
    ('agachamento-bulgaro-halter', 'Agachamento Búlgaro', 'Halter', 'Pernas'),
    ('agachamento-bulgaro-maquina', 'Agachamento Búlgaro', 'Máquina', 'Pernas'),
    ('passada', 'Passada', 'Halter', 'Pernas'),
    ('afundo', 'Afundo', 'Barra-Livre', 'Pernas'),
    ('elevacao-pelvica-barra-livre', 'Elevação Pélvica', 'Barra-Livre', 'Pernas'),
    ('elevacao-pelvica-maquina', 'Elevação Pélvica', 'Máquina', 'Pernas'),
    ('panturrilha-em-pe', 'Panturrilha em Pé', 'Máquina', 'Pernas'),
    ('panturrilha-sentado', 'Panturrilha Sentado', 'Máquina', 'Pernas'),
    ('cadeira-adutora', 'Cadeira Adutora', 'Máquina', 'Pernas'),
    ('cadeira-abdutora', 'Cadeira Abdutora', 'Máquina', 'Pernas'),

    -- Ombros
    ('desenvolvimento-halter', 'Desenvolvimento', 'Halter', 'Ombros'),
    ('desenvolvimento-maquina', 'Desenvolvimento', 'Máquina', 'Ombros'),
    ('desenvolvimento-smith', 'Desenvolvimento', 'Smith', 'Ombros'),
    ('desenvolvimento-arnold', 'Desenvolvimento Arnold', 'Halter', 'Ombros'),
    ('elevacao-lateral-halter', 'Elevação Lateral', 'Halter', 'Ombros'),
    ('elevacao-lateral-cabo', 'Elevação Lateral', 'Cabo', 'Ombros'),
    ('elevacao-lateral-maquina', 'Elevação Lateral', 'Máquina', 'Ombros'),
    ('elevacao-frontal', 'Elevação Frontal', 'Halter', 'Ombros'),

    -- Bíceps
    ('rosca-direta-barra', 'Rosca Direta', 'Barra', 'Bíceps'),
    ('rosca-direta-cabo', 'Rosca Direta', 'Cabo', 'Bíceps'),
    ('rosca-alternada', 'Rosca Alternada', 'Halter', 'Bíceps'),
    ('rosca-martelo-halter', 'Rosca Martelo', 'Halter', 'Bíceps'),
    ('rosca-martelo-cabo', 'Rosca Martelo', 'Cabo', 'Bíceps'),
    ('rosca-bayesian', 'Rosca Bayesian', 'Cabo', 'Bíceps'),
    ('rosca-banco-inclinado', 'Rosca Banco Inclinado', 'Halter', 'Bíceps'),
    ('rosca-scott-halter', 'Rosca Scott', 'Halter', 'Bíceps'),
    ('rosca-scott-maquina', 'Rosca Scott', 'Máquina', 'Bíceps'),
    ('rosca-scott-barra-livre', 'Rosca Scott', 'Barra-Livre', 'Bíceps'),
    ('rosca-scott-unilateral-halter', 'Rosca Scott Unilateral', 'Halter', 'Bíceps'),
    ('rosca-scott-unilateral-maquina', 'Rosca Scott Unilateral', 'Máquina', 'Bíceps'),
    ('rosca-concentrada', 'Rosca Concentrada', 'Halter', 'Bíceps'),

    -- Tríceps
    ('triceps-testa', 'Tríceps Testa', 'Barra', 'Tríceps'),
    ('triceps-corda', 'Tríceps Corda', 'Cabo', 'Tríceps'),
    ('triceps-pulley', 'Tríceps Pulley', 'Cabo', 'Tríceps'),
    ('triceps-frances-halter', 'Tríceps Francês', 'Halter', 'Tríceps'),
    ('triceps-frances-cabo', 'Tríceps Francês', 'Cabo', 'Tríceps'),
    ('triceps-unilateral', 'Tríceps Unilateral', 'Cabo', 'Tríceps'),

    -- Abdominais
    ('abdominal-supra-peso-corporal', 'Abdominal Supra', 'Peso Corporal', 'Abdominais'),
    ('abdominal-supra-maquina', 'Abdominal Supra', 'Máquina', 'Abdominais'),
    ('abdominal-supra-cabo', 'Abdominal Supra', 'Cabo', 'Abdominais'),
    ('abdominal-infra-elevacao-de-pernas', 'Abdominal Infra (Elevação de Pernas)', 'Barra Fixa', 'Abdominais'),
    ('abdominal-infra-peso-corporal', 'Abdominal Infra', 'Peso Corporal', 'Abdominais'),
    ('abdominal-obliquo-peso-corporal', 'Abdominal Oblíquo', 'Peso Corporal', 'Abdominais'),
    ('abdominal-obliquo-cabo', 'Abdominal Oblíquo', 'Cabo', 'Abdominais'),
    ('prancha-isometrica', 'Prancha Isométrica', 'Peso Corporal', 'Abdominais'),
    ('abdominal-roda', 'Abdominal Roda (Ab Wheel)', 'Peso Corporal', 'Abdominais'),
    ('abdominal-remador', 'Abdominal Remador', 'Peso Corporal', 'Abdominais'),

    -- Trapézio
    ('encolhimento-halter', 'Encolhimento', 'Halter', 'Trapézio'),
    ('encolhimento-barra-livre', 'Encolhimento', 'Barra-Livre', 'Trapézio'),
    ('encolhimento-smith', 'Encolhimento', 'Smith', 'Trapézio'),
    ('encolhimento-maquina', 'Encolhimento', 'Máquina', 'Trapézio'),
    ('remada-alta-barra-livre', 'Remada Alta', 'Barra-Livre', 'Trapézio'),
    ('remada-alta-polia', 'Remada Alta', 'Polia', 'Trapézio'),

    -- Antebraços
    ('rosca-inversa-barra', 'Rosca Inversa', 'Barra', 'Antebraços'),
    ('rosca-inversa-polia', 'Rosca Inversa', 'Polia', 'Antebraços'),
    ('rosca-punho-barra', 'Rosca Punho', 'Barra', 'Antebraços'),
    ('rosca-punho-halter', 'Rosca Punho', 'Halter', 'Antebraços'),
    ('rosca-punho-polia', 'Rosca Punho', 'Polia', 'Antebraços'),
    ('rosca-punho-inversa-barra', 'Rosca Punho Inversa', 'Barra', 'Antebraços'),
    ('rosca-punho-inversa-halter', 'Rosca Punho Inversa', 'Halter', 'Antebraços')
;

-- Reaproveita linhas legadas do catálogo quando elas já existem no banco,
-- mas ainda não possuem `system_key`.
UPDATE public.exercises AS exercise
SET
  system_key = seed.system_key,
  user_id = NULL,
  name = seed.name,
  is_system = TRUE,
  modality = seed.modality,
  muscle_group = seed.muscle_group,
  archived_at = NULL
FROM tmp_system_exercise_seed AS seed
WHERE exercise.system_key IS NULL
  AND (exercise.user_id IS NULL OR exercise.is_system = TRUE)
  AND lower(btrim(exercise.name)) = lower(btrim(seed.name))
  AND lower(btrim(COALESCE(exercise.modality, ''))) = lower(btrim(COALESCE(seed.modality, '')));

INSERT INTO public.exercises (
  system_key,
  user_id,
  name,
  is_system,
  modality,
  muscle_group,
  archived_at
)
SELECT
  system_key,
  NULL,
  name,
  TRUE,
  modality,
  muscle_group,
  NULL
FROM tmp_system_exercise_seed
ON CONFLICT (system_key) DO UPDATE SET
  user_id = NULL,
  name = EXCLUDED.name,
  is_system = TRUE,
  modality = EXCLUDED.modality,
  muscle_group = EXCLUDED.muscle_group,
  archived_at = NULL;

COMMIT;
