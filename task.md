# GymTracker — Plano de Correções de Produção

## P0 — Crítico

### 1. Analytics por exercício (cross-workout)
- [ ] Criar nova query no repository que busca `set_logs` por `exercise_id` + `user_id` **sem filtro de workout**
- [ ] Criar service function `getExerciseAnalytics(exerciseId)` reutilizando [buildEvolution](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#31-55) e [buildSummary](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#56-100)
- [ ] Criar server action `getExerciseAnalyticsAction`
- [ ] Adicionar aba/toggle na UI de analytics: "Por Treino" vs "Por Exercício (global)"
- [ ] Adicionar índice [(exercise_id, session_id)](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/components/analytics-page-client.tsx#23-24) ao schema SQL (migration)

### 2. Exclusão de exercício com UX adequada
- [ ] Adicionar coluna `archived_at TIMESTAMPTZ` na tabela `exercises` (migration)
- [ ] Alterar query de listagem para filtrar `WHERE archived_at IS NULL`
- [ ] Criar função de archive no repository/service
- [ ] Alterar UI do `exercise-card.tsx`: verificar se há `set_logs` antes de deletar
- [ ] Se houver histórico: mostrar dialog oferecendo "Arquivar" em vez de "Deletar"
- [ ] Se não houver histórico: permitir delete direto (já funciona)

## P1 — Importante

### 3. Testes para o analytics service
- [ ] Configurar Vitest no projeto
- [ ] Escrever testes unitários para [estimated1RM()](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#7-13)
- [ ] Escrever testes unitários para [findBestSet()](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#14-30)
- [ ] Escrever testes unitários para [buildEvolution()](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#31-55)
- [ ] Escrever testes unitários para [buildSummary()](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/service.ts#56-100) (trend up/down/stable)

### 4. Constraint de sessão única por dia
- [ ] Adicionar `UNIQUE(user_id, workout_id, performed_at)` na tabela `workout_sessions` (migration)
- [ ] Usar `ON CONFLICT` no upsert do [saveSession](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/today/repository.ts#367-379) em [today/service.ts](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/today/service.ts)

## P2 — Moderado

### 5. Validação de input nas server actions
- [ ] Validar formato UUID em [getWorkoutAnalyticsAction](file:///c:/Users/Sergio/Documents/GitHub/muscula%C3%A7%C3%A3o/gymtracker/src/features/analytics/actions.ts#8-16)
- [ ] Validar formato UUID e payload em `saveSessionAction`
- [ ] Validar formato UUID em `skipOrRescheduleAction`

### 6. Índice para analytics por exercício
- [ ] (Coberto no item 1 — migration de índice)
