# Plano de Implementacao — Correcões de Producao GymTracker

## Contexto

Este plano consolida o que o projeto queria entregar e o que ja foi implementado no codigo atual.

Status revisado em `2026-03-31`:

- o deploy no Vercel esta compilando e ficando `READY`
- o app publicado abre e redireciona corretamente para `/login` quando nao autenticado
- havia um bug real de producao no `proxy` protegendo arquivos publicos como `manifest.json`, `robots.txt` e `sitemap.xml`
- esse bug ja foi corrigido em `gymtracker/src/proxy.ts`

Tambem havia itens do plano antigo que ficaram desatualizados:

- varias funcoes do analytics ja estao exportadas
- parte das migrations ja existe no repositorio
- a UX de archive de exercicios ja foi implementada em `workout-editor-client.tsx`
- algumas referencias de arquivo estavam apontando para componentes que nao existem mais

---

## Estado Atual

### Ja implementado

#### Analytics cross-workout por exercicio

- `getExerciseAnalyticsRepository(exerciseId)` existe
- `getExerciseGlobalAnalytics(exerciseId)` existe
- `getExerciseGlobalAnalyticsAction(exerciseId)` existe
- tipo `ExerciseGlobalAnalyticsData` existe
- UI com escopo `This Workout` vs `All Workouts` ja existe

#### Archive de exercicios

- migration `20260315_add_archived_at_to_exercises.sql` existe
- filtro de exercicios arquivados ja existe na listagem
- `archiveExerciseRepository`, `archiveExerciseAction` e `checkExerciseHasLogsAction` existem
- dialogo de archive/remocao ja existe em `src/features/workouts/components/workout-editor-client.tsx`

#### Constraint de sessao unica

- migration `20260315_unique_session_per_day.sql` existe
- o fluxo de criacao em `src/features/today/repository.ts` ja trata `23505` e recupera a sessao existente

#### Testabilidade do analytics service

- `estimated1RM`, `findBestSet`, `buildEvolution` e `buildSummary` ja estao exportadas
- `vitest.config.ts` ja existe
- `vitest` e `@vitest/coverage-v8` ja estao em `devDependencies`

---

## Ajustes Ainda Necessarios

### 1. Fechar a configuracao de testes

Arquivo:
- `gymtracker/package.json`

Ainda falta:
- adicionar script `test`
- adicionar script `test:watch`
- criar os testes unitarios do analytics service, se ainda nao tiverem sido escritos

Observacao:
- o plano antigo tratava toda a configuracao de testes como pendente, mas hoje ela esta parcialmente pronta

### 2. Revisar validacao das server actions

Arquivos:
- `gymtracker/src/features/analytics/actions.ts`
- `gymtracker/src/features/today/actions.ts`
- `gymtracker/src/features/schedule/actions.ts`

Ainda vale implementar:
- validacao de UUID
- validacao de payload
- mensagens de erro mais previsiveis

### 3. Registrar o bug de producao do proxy como item resolvido

Arquivo:
- `gymtracker/src/proxy.ts`

Correcao aplicada:
- excluir `manifest.json`, `robots.txt`, `sitemap.xml` e outros assets publicos do matcher do proxy

Impacto:
- evita que navegador, instalacao PWA e crawlers recebam HTML de login no lugar de arquivos publicos

### 4. Revisar configuracao de dominio publico

Arquivos afetados:
- `gymtracker/src/app/layout.tsx`
- `gymtracker/src/app/robots.ts`
- `gymtracker/src/app/sitemap.ts`
- variavel `NEXT_PUBLIC_SITE_URL` no Vercel

Risco atual:
- se `NEXT_PUBLIC_SITE_URL` estiver diferente do dominio real publicado, callbacks e metadados ficam inconsistentes

---

## Verification Plan

### Testes automatizados

Rodar:

```bash
npm run lint
npm test
```

### Build

Rodar:

```bash
npm run build
```

Observacao importante:
- localmente ou em ambiente sem acesso externo o build pode falhar por causa do `next/font/google`
- no Vercel o build atual esta passando

### Smoke test manual

Validar em producao:

1. abrir `/login`
2. confirmar que `manifest.json` responde JSON valido
3. confirmar que `robots.txt` e `sitemap.xml` nao redirecionam para login
4. autenticar com Supabase
5. abrir `today`, `workouts` e `analytics`
6. testar archive de exercicio com historico
7. testar analytics global por exercicio

---

## Resumo

O plano original estava bom na intencao, mas ficou atras do estado real do codigo. Hoje o trabalho mais importante nao e mais "implementar tudo isso do zero", e sim:

- fechar os testes que faltam
- endurecer validacoes
- garantir configuracao correta de dominio/env no Vercel e Supabase
- manter o deploy estavel, agora com o proxy corrigido
