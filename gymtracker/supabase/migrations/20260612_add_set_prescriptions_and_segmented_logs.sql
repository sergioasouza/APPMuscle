BEGIN;

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS set_prescriptions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.set_logs
  ADD COLUMN IF NOT EXISTS prescription_id UUID,
  ADD COLUMN IF NOT EXISTS set_method TEXT NOT NULL DEFAULT 'straight',
  ADD COLUMN IF NOT EXISTS prescription_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS actual_rir NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'completed';

ALTER TABLE public.workout_exercises
  DROP CONSTRAINT IF EXISTS workout_exercises_set_prescriptions_array_check;

ALTER TABLE public.workout_exercises
  ADD CONSTRAINT workout_exercises_set_prescriptions_array_check
  CHECK (
    jsonb_typeof(set_prescriptions) = 'array'
    AND jsonb_array_length(set_prescriptions) BETWEEN 1 AND 20
  ) NOT VALID;

ALTER TABLE public.set_logs
  DROP CONSTRAINT IF EXISTS set_logs_set_method_check,
  DROP CONSTRAINT IF EXISTS set_logs_state_check,
  DROP CONSTRAINT IF EXISTS set_logs_actual_rir_check,
  DROP CONSTRAINT IF EXISTS set_logs_segments_array_check;

ALTER TABLE public.set_logs
  ADD CONSTRAINT set_logs_set_method_check
  CHECK (set_method IN ('straight', 'cluster', 'myo_reps', 'drop_set', 'rest_pause', 'amrap')),
  ADD CONSTRAINT set_logs_state_check
  CHECK (state IN ('in_progress', 'completed', 'stopped')),
  ADD CONSTRAINT set_logs_actual_rir_check
  CHECK (actual_rir IS NULL OR actual_rir BETWEEN 0 AND 10),
  ADD CONSTRAINT set_logs_segments_array_check
  CHECK (jsonb_typeof(segments) = 'array' AND jsonb_array_length(segments) >= 1) NOT VALID;

UPDATE public.workout_exercises AS workout_exercise
SET set_prescriptions = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'position', set_position,
      'method', 'straight',
      'config', jsonb_build_object(
        'targetReps', NULL,
        'restSeconds', NULL,
        'targetWeightKg', NULL,
        'targetRir', NULL
      )
    )
    ORDER BY set_position
  )
  FROM generate_series(1, workout_exercise.target_sets) AS set_position
)
WHERE jsonb_array_length(workout_exercise.set_prescriptions) = 0;

WITH matched_prescriptions AS (
  SELECT DISTINCT ON (set_log.id)
    set_log.id AS set_log_id,
    (prescription.value->>'id')::uuid AS prescription_id,
    prescription.value AS prescription_snapshot
  FROM public.set_logs AS set_log
  JOIN public.workout_sessions AS workout_session
    ON workout_session.id = set_log.session_id
  JOIN public.workout_exercises AS workout_exercise
    ON workout_exercise.workout_id = workout_session.workout_id
  LEFT JOIN public.session_exercise_substitutions AS substitution
    ON substitution.session_id = workout_session.id
    AND substitution.replacement_exercise_id = set_log.exercise_id
  CROSS JOIN LATERAL jsonb_array_elements(workout_exercise.set_prescriptions)
    WITH ORDINALITY AS prescription(value, ordinal)
  WHERE (
      workout_exercise.exercise_id = set_log.exercise_id
      OR workout_exercise.exercise_id = substitution.original_exercise_id
    )
    AND prescription.ordinal = set_log.set_number
  ORDER BY set_log.id, workout_exercise.id
)
UPDATE public.set_logs AS set_log
SET
  prescription_id = matched.prescription_id,
  set_method = 'straight',
  prescription_snapshot = matched.prescription_snapshot,
  segments = jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'position', 1,
      'kind', 'work',
      'weightKg', set_log.weight_kg,
      'reps', set_log.reps,
      'targetReps', NULL,
      'suggestedWeightKg', NULL,
      'completed', TRUE
    )
  ),
  state = 'completed'
FROM matched_prescriptions AS matched
WHERE set_log.id = matched.set_log_id
  AND set_log.prescription_id IS NULL;

UPDATE public.set_logs AS set_log
SET
  segments = jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'position', 1,
      'kind', 'work',
      'weightKg', set_log.weight_kg,
      'reps', set_log.reps,
      'targetReps', NULL,
      'suggestedWeightKg', NULL,
      'completed', TRUE
    )
  ),
  prescription_snapshot = COALESCE(
    set_log.prescription_snapshot,
    jsonb_build_object(
      'id', COALESCE(set_log.prescription_id, gen_random_uuid()),
      'position', set_log.set_number,
      'method', 'straight',
      'config', jsonb_build_object(
        'targetReps', NULL,
        'restSeconds', NULL,
        'targetWeightKg', NULL,
        'targetRir', NULL
      )
    )
  )
WHERE jsonb_array_length(set_log.segments) = 0;

UPDATE public.set_logs
SET prescription_id = (prescription_snapshot->>'id')::uuid
WHERE prescription_id IS NULL
  AND prescription_snapshot ? 'id';

CREATE OR REPLACE FUNCTION public.sync_workout_exercise_set_prescriptions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_count INT;
BEGIN
  current_count := CASE
    WHEN NEW.set_prescriptions IS NOT NULL
      AND jsonb_typeof(NEW.set_prescriptions) = 'array'
      THEN jsonb_array_length(NEW.set_prescriptions)
    ELSE 0
  END;

  IF TG_OP = 'UPDATE'
    AND NEW.target_sets IS DISTINCT FROM OLD.target_sets
    AND NEW.set_prescriptions IS NOT DISTINCT FROM OLD.set_prescriptions
    AND current_count > 0 THEN
    IF NEW.target_sets < current_count THEN
      SELECT jsonb_agg(item.value ORDER BY item.ordinal)
      INTO NEW.set_prescriptions
      FROM jsonb_array_elements(NEW.set_prescriptions)
        WITH ORDINALITY AS item(value, ordinal)
      WHERE item.ordinal <= GREATEST(1, NEW.target_sets);
    ELSIF NEW.target_sets > current_count THEN
      SELECT NEW.set_prescriptions || COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', gen_random_uuid(),
            'position', set_position,
            'method', 'straight',
            'config', jsonb_build_object(
              'targetReps', NULL,
              'restSeconds', NULL,
              'targetWeightKg', NULL,
              'targetRir', NULL
            )
          )
          ORDER BY set_position
        ),
        '[]'::jsonb
      )
      INTO NEW.set_prescriptions
      FROM generate_series(current_count + 1, NEW.target_sets) AS set_position;
    END IF;
  END IF;

  IF NEW.set_prescriptions IS NULL
    OR jsonb_typeof(NEW.set_prescriptions) <> 'array'
    OR jsonb_array_length(NEW.set_prescriptions) = 0 THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'position', set_position,
        'method', 'straight',
        'config', jsonb_build_object(
          'targetReps', NULL,
          'restSeconds', NULL,
          'targetWeightKg', NULL,
          'targetRir', NULL
        )
      )
      ORDER BY set_position
    )
    INTO NEW.set_prescriptions
    FROM generate_series(1, GREATEST(1, NEW.target_sets)) AS set_position;
  END IF;

  NEW.target_sets := jsonb_array_length(NEW.set_prescriptions);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_workout_exercise_set_prescriptions
  ON public.workout_exercises;

CREATE TRIGGER sync_workout_exercise_set_prescriptions
BEFORE INSERT OR UPDATE OF target_sets, set_prescriptions
ON public.workout_exercises
FOR EACH ROW
EXECUTE FUNCTION public.sync_workout_exercise_set_prescriptions();

ALTER TABLE public.workout_exercises
  VALIDATE CONSTRAINT workout_exercises_set_prescriptions_array_check;

ALTER TABLE public.set_logs
  VALIDATE CONSTRAINT set_logs_segments_array_check;

ALTER TABLE public.set_logs
  ALTER COLUMN prescription_id SET NOT NULL,
  ALTER COLUMN prescription_snapshot SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_set_logs_session_exercise_prescription
  ON public.set_logs(session_id, exercise_id, prescription_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_prescription_id
  ON public.set_logs(prescription_id);

COMMIT;
