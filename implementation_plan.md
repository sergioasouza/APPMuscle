# Plano de Implementação — Correções de Produção GymTracker

## Contexto

Auditoria identificou 10 issues. Este plano implementa as **5 correções prioritárias** (P0–P1) com etapas concretas.

---

## Proposed Changes

### P1 — Testes para analytics service

> [!IMPORTANT]
> Implementar **antes** dos demais, para que as funções puras existentes tenham cobertura antes de refatorá-las.

#### [NEW] vitest.config.ts

Configuração do Vitest com suporte a `@/` path alias.

#### [MODIFY] [package.json](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/package.json)

- Adicionar `vitest` e `@vitest/coverage-v8` como devDependencies
- Adicionar script `"test": "vitest run"`, `"test:watch": "vitest"`

#### [NEW] src/features/analytics/\_\_tests\_\_/analytics-service.test.ts

Testes unitários (sem Supabase) para as funções puras do service:

1. [estimated1RM](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#7-13) — peso=0, reps=0, reps=1, caso normal
2. [findBestSet](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#14-30) — lista vazia, sessão sem sets válidos, melhor set por 1RM
3. [buildEvolution](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#31-55) — sessões sem sets, sessões com progressão, ordem cronológica
4. [buildSummary](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#56-100) — trend [up](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/today/components/today-page-client.tsx#95-105), `down`, `stable`, limiar de ±2%

> As funções [estimated1RM](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#7-13), [findBestSet](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#14-30), [buildEvolution](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#31-55), e [buildSummary](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#56-100) são atualmente privadas no módulo. Será necessário exportá-las para teste (ou usar `export { ... } for testing`).

#### [MODIFY] [service.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts)

Exportar funções puras para permitir teste:
```diff
-function estimated1RM(...)
+export function estimated1RM(...)
```
(Idem para [findBestSet](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#14-30), [buildEvolution](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#31-55), [buildSummary](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#56-100))

---

### P0a — Analytics cross-workout (por exercício)

#### [MODIFY] [repository.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/repository.ts)

Nova função `getExerciseAnalyticsRepository(exerciseId)`:
- Busca `workout_sessions` por `user_id` (sem filtro de `workout_id`)
- Busca `set_logs` por `exercise_id` + session_ids
- Retorna sessions + setLogs

#### [MODIFY] [service.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts)

Nova função `getExerciseGlobalAnalytics(exerciseId)`:
- Chama `getExerciseAnalyticsRepository`
- Reutiliza [buildEvolution](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#31-55) e [buildSummary](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#56-100)
- Retorna `{ evolution, summary }`

#### [MODIFY] [actions.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/actions.ts)

Nova action `getExerciseGlobalAnalyticsAction(exerciseId)`

#### [MODIFY] [types.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/types.ts)

Novo tipo `ExerciseGlobalAnalyticsData { evolution, summary }`

#### UI — toggle "Por Treino" / "Global"

> [!WARNING]
> A UI de analytics é client-side com estado local. Mudanças na UI dependem de revisão visual do usuário. As mudanças abaixo são mínimas.

Adicionar um botão toggle no componente de analytics que, ao clicar "Global", chama a nova action e exibe dados cross-workout para o exercício selecionado.

---

### P0b — Archive de exercícios

#### [NEW] supabase/migrations/20260315\_add\_archived\_at\_to\_exercises.sql

```sql
ALTER TABLE public.exercises ADD COLUMN archived_at TIMESTAMPTZ;
CREATE INDEX idx_exercises_archived ON public.exercises(user_id) WHERE archived_at IS NULL;
```

#### [MODIFY] [workouts/repository.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/workouts/repository.ts)

- [listAvailableExercisesRepository](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/workouts/repository.ts#65-94): adicionar `.is('archived_at', null)` ao filtro
- Nova função `archiveExerciseRepository(exerciseId)` — faz `UPDATE exercises SET archived_at = NOW() WHERE id = ?`
- Nova função `checkExerciseHasLogsRepository(exerciseId)` — conta `set_logs` por `exercise_id`

#### [MODIFY] [workouts/service.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/workouts/service.ts)

Nova função `archiveExercise(exerciseId)` + `checkExerciseHasLogs(exerciseId)`

#### [MODIFY] [workouts/actions.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/workouts/actions.ts)

Novas actions: `archiveExerciseAction`, `checkExerciseHasLogsAction`

#### UI — Dialog de confirmação no editor de workout

No [workout-editor-client.tsx](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/workouts/components/workout-editor-client.tsx), quando o usuário clica delete em um exercício:
1. Chama `checkExerciseHasLogsAction`
2. Se tem logs → abre dialog "Este exercício tem X sessões registradas. Deseja arquivá-lo?"
3. Se não tem logs → permite delete direto (comportamento atual)

---

### P1b — Unique constraint em sessions

#### [NEW] supabase/migrations/20260315\_unique\_session\_per\_day.sql

```sql
ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_user_workout_date_key
  UNIQUE (user_id, workout_id, performed_at);
```

#### [MODIFY] [today/repository.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/today/repository.ts)

Ajustar inserts em sessions para usar `ON CONFLICT … DO NOTHING` ou `DO UPDATE`.

---

## Verification Plan

### Testes Automatizados

```bash
# Rodar após instalar Vitest (item P1)
npm test
```

Espera-se ~15 testes passando cobrindo as funções puras do analytics service.

### Build Check

```bash
npm run build
```

Garante que typescript compila sem erros e o Next.js build completa.

### Teste Manual pelo Usuário

> [!IMPORTANT]
> Após aplicar as migrations no Supabase, o usuário deve testar:
> 1. Abrir analytics de um treino → verificar que toggle "Global" funciona
> 2. Tentar deletar exercício com histórico → verificar que dialog de archive aparece
> 3. Verificar que exercícios arquivados não aparecem na lista de "adicionar exercício"

Estes testes manuais dependem do ambiente Supabase do usuário.
