# Upgrade da Página de Análise (Analytics)

## Situação Atual

A análise atual tem duas views: (1) **gráfico de barras** com volume total por sessão (máx 3 selecionadas), e (2) **tabela comparativa** de séries por exercício. O gráfico é superficial — mostra apenas um número agregado e requer seleção manual de sessões.

## Mudanças Propostas

### 1. Gráfico de Evolução por Exercício (PRINCIPAL)

Substituir o gráfico de barras por um **LineChart** que mostra a evolução **treino a treino** para cada exercício:

- **Eixo X**: sessões em ordem cronológica (todas, sem limite de 3)
- **Eixo Y**: peso (kg) ou 1RM estimado
- **Seletor de exercício**: dropdown ou lista horizontal para alternar entre exercícios do treino
- **Métrica por ponto**: melhor série válida da sessão (maior peso × reps → fórmula Epley: `1RM = peso × (1 + reps/30)`)
- **Duas linhas opcionais**: "Peso máximo" e "1RM estimado" no mesmo chart
- **Tooltip**: mostra data, peso, reps e 1RM estimado

```
📈 Evolução: Supino Reto
│
│          ●──●
│     ●──●
│  ●
│
└──────────────────────
  01/02  08/02  15/02  22/02  01/03
```

### 2. Cards de Resumo

Acima do gráfico, 3 cards com métricas rápidas:
- **PR Atual**: melhor 1RM estimado do exercício selecionado
- **Último Treino**: peso × reps da melhor série da sessão mais recente
- **Tendência**: ↑/↓/→ comparando as últimas 3 sessões

### 3. Manter a Tabela Comparativa (melhorada)

A tabela atual de comparação set-by-set continua como uma segunda aba, mas:
- Remover limite de 3 sessões → permitir selecionar **todas** (scroll horizontal)
- Destacar visualmente **PR** em cada célula (cor diferente quando é recorde)
- Mostrar variação (Δ) entre sessões adjacentes

### 4. Melhorias de UX

- O seletor de treino fica no topo (mantém)
- Após selecionar o treino, mostra **diretamente o gráfico de evolução** do primeiro exercício (sem precisar selecionar sessões manualmente)
- Tabs: `📈 Evolução` | `📋 Comparação`

---

## Arquivos Modificados

### Analytics Feature

#### [MODIFY] [analytics-page-client.tsx](file:///c:/Users/Sergio/Documents/GitHub/musculação/gymtracker/src/features/analytics/components/analytics-page-client.tsx)

Refatoração completa:
- Novo layout com tabs `Evolução` / `Comparação`
- Componente do gráfico de evolução (LineChart do Recharts)
- Seletor de exercício
- Cards de resumo
- Lógica de cálculo de 1RM estimado (Epley)
- Melhoria da tabela comparativa (highlight de PRs, scroll horizontal)

#### [MODIFY] [types.ts](file:///c:/Users/Sergio/Documents/GitHub/musculação/gymtracker/src/features/analytics/types.ts)

Novos tipos:
- `ExerciseEvolutionPoint` (sessionDate, weight, reps, estimated1RM)
- `ExerciseSummary` (currentPR, lastWorkout, trend)

#### [MODIFY] [service.ts](file:///c:/Users/Sergio/Documents/GitHub/musculação/gymtracker/src/features/analytics/service.ts)

Pré-computar dados de evolução no servidor:
- Para cada exercício, extrair a melhor série de cada sessão
- Calcular 1RM estimado por sessão
- Retornar dados prontos para o gráfico

### i18n

#### [MODIFY] [pt.json](file:///c:/Users/Sergio/Documents/GitHub/musculação/gymtracker/src/messages/pt.json)
#### [MODIFY] [en.json](file:///c:/Users/Sergio/Documents/GitHub/musculação/gymtracker/src/messages/en.json)

Novas chaves: `Analytics.evolution`, `Analytics.comparison`, `Analytics.currentPR`, `Analytics.lastWorkout`, `Analytics.trend`, `Analytics.estimated1RM`, `Analytics.bestSet`, `Analytics.up`, `Analytics.down`, `Analytics.stable`, etc.

---

## Verificação

1. `npx next build` — confirmar que compila sem erros
2. `npm run dev` → navegar para `/analytics`:
   - Selecionar treino → ver gráfico de evolução imediatamente
   - Alternar entre exercícios → gráfico atualiza
   - Cards de resumo mostram dados corretos
   - Tab "Comparação" mostra a tabela com PRs destacados
3. Testar com poucos dados (1 sessão) e muitos dados (10+ sessões)
