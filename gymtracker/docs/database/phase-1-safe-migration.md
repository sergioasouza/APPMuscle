# Phase 1 — Migração segura do banco

Objetivo: corrigir os principais problemas de modelagem e RLS sem apagar os exercícios, treinos e logs já existentes.

## O que esta migração faz

Arquivo: [supabase/migrations/20260306_phase1_preserve_existing_data.sql](../../supabase/migrations/20260306_phase1_preserve_existing_data.sql)

### 1. Preserva dados antes de limpar duplicidades
Antes de qualquer ajuste, a migração cria snapshots:

- `public.backup_workout_exercises_20260306`
- `public.backup_set_logs_20260306`

Assim, mesmo se houver duplicidades históricas, o estado anterior fica salvo no banco.

### 2. Corrige multi-tenancy em `exercises`
- remove `UNIQUE(name)` global
- restringe leitura para o próprio dono
- cria unicidade por usuário: `user_id + lower(trim(name))`

### 3. Corrige duplicidades em `workout_exercises`
- mantém só um vínculo por par `workout_id + exercise_id`
- preserva o maior `target_sets`
- reordena `display_order`
- adiciona constraint para evitar novas duplicidades

### 4. Corrige duplicidades em `set_logs`
- mantém só um registro por `session_id + exercise_id + set_number`
- preserva o log mais recente
- adiciona constraints para validar `set_number`, `reps` e `weight_kg`

## O que ela propositalmente NÃO faz ainda

- não força `UNIQUE(user_id, performed_at)` em `workout_sessions`
- não altera o modelo funcional de sessões por dia

Isso foi deixado para uma fase seguinte para não quebrar dados históricos sem validar a regra de negócio primeiro.

## Ordem recomendada de execução

1. abrir o Supabase SQL Editor
2. executar [supabase/migrations/20260306_phase1_preserve_existing_data.sql](../../supabase/migrations/20260306_phase1_preserve_existing_data.sql)
3. executar [supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql](../../supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql)
4. executar [supabase/migrations/20260315_add_archived_at_to_exercises.sql](../../supabase/migrations/20260315_add_archived_at_to_exercises.sql)
5. executar [supabase/migrations/20260402_add_body_metrics_and_schedule_rotations.sql](../../supabase/migrations/20260402_add_body_metrics_and_schedule_rotations.sql)
6. executar [supabase/migrations/20260405_add_system_exercises_and_overrides.sql](../../supabase/migrations/20260405_add_system_exercises_and_overrides.sql)
7. executar [supabase/migrations/20260406_seed_system_exercises_catalog.sql](../../supabase/migrations/20260406_seed_system_exercises_catalog.sql)
8. executar [supabase/migrations/20260410_add_admin_access_manual_billing.sql](../../supabase/migrations/20260410_add_admin_access_manual_billing.sql)
9. validar se os backups foram criados
10. regenerar os tipos do Supabase para manter [src/lib/types.ts](../../src/lib/types.ts) sincronizado

## Baseline atual esperado pela aplicação

- `profiles.rotation_anchor_date`
- `profiles.role`
- `profiles.access_status`
- `profiles.paid_until`
- `profiles.must_change_password`
- `exercises.archived_at`
- `exercises.is_system`
- `exercise_overrides`
- `schedule_rotations`
- `body_measurements`
- `manual_billing_events`
- `admin_audit_log`
- trigger `on_auth_user_created` saudável para bootstrap de `profiles`

## Verificações pós-migração

### Exercícios duplicados por usuário
```sql
select user_id, lower(btrim(name)) as normalized_name, count(*)
from public.exercises
group by user_id, lower(btrim(name))
having count(*) > 1;
```

### Exercícios repetidos no mesmo treino
```sql
select workout_id, exercise_id, count(*)
from public.workout_exercises
group by workout_id, exercise_id
having count(*) > 1;
```

### Sets duplicados dentro da mesma sessão
```sql
select session_id, exercise_id, set_number, count(*)
from public.set_logs
group by session_id, exercise_id, set_number
having count(*) > 1;
```
