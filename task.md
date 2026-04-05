# GymTracker — Tarefas de Correcao de Producao

## Leitura correta do estado atual

Este arquivo foi atualizado para refletir o codigo atual do projeto, nao o estado antigo do planejamento.

Status em `2026-03-31`:

- analytics global por exercicio: implementado
- archive de exercicios com dialogo: implementado
- migrations principais: presentes no repositorio
- sessao unica por dia: parcialmente protegida via migration + tratamento de `23505`
- bug do proxy em arquivos publicos: corrigido

---

## P0 — Critico

### 1. Garantir recursos publicos fora da autenticacao
- [x] Excluir `manifest.json` do `proxy`
- [x] Excluir `robots.txt` do `proxy`
- [x] Excluir `sitemap.xml` do `proxy`
- [x] Excluir assets publicos do matcher do `proxy`

Arquivos:
- `gymtracker/src/proxy.ts`

### 2. Validar dominio publico configurado
- [ ] Conferir `NEXT_PUBLIC_SITE_URL` no Vercel
- [ ] Garantir que o dominio configurado bate com o dominio real publicado
- [ ] Revisar URLs do Supabase Auth para callback/login/logout

Arquivos relacionados:
- `gymtracker/src/app/layout.tsx`
- `gymtracker/src/app/robots.ts`
- `gymtracker/src/app/sitemap.ts`

## P1 — Importante

### 3. Fechar a parte que falta dos testes do analytics
- [x] Configurar `vitest.config.ts`
- [x] Exportar funcoes puras do analytics service
- [ ] Adicionar script `test` em `package.json`
- [ ] Adicionar script `test:watch` em `package.json`
- [ ] Escrever testes unitarios para `estimated1RM()`
- [ ] Escrever testes unitarios para `findBestSet()`
- [ ] Escrever testes unitarios para `buildEvolution()`
- [ ] Escrever testes unitarios para `buildSummary()`

Arquivos:
- `gymtracker/package.json`
- `gymtracker/vitest.config.ts`
- `gymtracker/src/features/analytics/service.ts`

### 4. Endurecer validacao das server actions
- [ ] Validar formato UUID em `getWorkoutAnalyticsAction`
- [ ] Validar formato UUID e payload em `saveSessionAction`
- [ ] Validar formato UUID em `skipOrRescheduleAction`

## P2 — Moderado

### 5. Revisar consistencia do fluxo de sessao unica por dia
- [x] Adicionar migration de `UNIQUE(user_id, workout_id, performed_at)`
- [x] Tratar `23505` ao criar sessao concorrente
- [ ] Revisar se outros inserts/updates do fluxo de `today` tambem precisam de `upsert` ou recuperacao defensiva

Arquivos:
- `gymtracker/supabase/migrations/20260315_unique_session_per_day.sql`
- `gymtracker/src/features/today/repository.ts`

### 6. Confirmar UX de archive de exercicios
- [x] Filtrar `archived_at IS NULL` na biblioteca
- [x] Verificar historico antes de remover
- [x] Mostrar dialogo de archive no editor
- [x] Evitar reexibir exercicio arquivado no picker

Arquivo correto da UI:
- `gymtracker/src/features/workouts/components/workout-editor-client.tsx`

Observacao:
- a referencia antiga para `exercise-card.tsx` estava errada; esse componente nao e o ponto atual da UX
