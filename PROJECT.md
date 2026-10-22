# Refined Redmine — base de conhecimento do projeto

> Documento vivo: registra o que existe, por que foi feito assim, o que falta e o que aprendemos.
> **Atualize este arquivo a cada mudança** (seção relevante + entrada no [Histórico](#histórico)).
> O `README.md` é o guia rápido de uso; este arquivo é a memória do projeto.

Última atualização: 2026-10-22

---

## 1. Visão

App desktop (macOS e Windows) que substitui o uso diário da interface do Redmine, que é arcaica, no dia a dia do time:
kanban de verdade, notificações nativas do sistema, visão de sprints, agenda com lembretes e um painel inicial.
Futuro: integração com o Mattermost (chat do time).

**Princípios**

- **Sem backend (por enquanto).** Cada pessoa informa a URL do Redmine e a própria API key; o app conversa direto
  com a API REST. Consequência: o monitor só roda enquanto o app está aberto (inclusive na bandeja).
- **O Redmine continua sendo a fonte da verdade.** O app só guarda localmente a configuração (quadros, preferências)
  e o estado do monitor.
- **A API key nunca chega à interface.** Toda chamada passa pelo processo principal.

## 2. Convenções de Redmine suportadas

> Ids, campos e valores do Redmine da empresa ficam em `NOTAS-INTERNAS.md`, fora do git (veja o `.gitignore`).

| Item                | Valor / regra                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Redmine             | versão ≥ 5 (aceita `include=allowed_statuses`)                                                                                 |
| Sprint              | versão `X.Y` (ex.: `3.78`); padrão configurável por regex                                                                      |
| Correção            | versão `X.Y.Z` (ex.: `3.77.1`) = correções da sprint `X.Y` na branch de homologação                                            |
| Agrupadores         | versões sem número (`backlog`…)                                                                                                |
| Campos da versão    | datas da sprint em campos personalizados da versão, detectados pelo nome (prazo dos devs e publicação)                         |
| Status fechado      | o que o Redmine marca como `is_closed`; status "resolvidos" ou "em teste" podem continuar abertos                              |
| Texto das tarefas   | Markdown (descrições usam `#`, tabelas, código)                                                                                |
| Campos obrigatórios | campos personalizados exigidos por tipo são aprendidos das tarefas recentes do projeto (só administradores leem as definições) |
| Ciclo da sprint     | desenvolvimento → _prazo dos devs_ → homologação → _publicação_ → produção                                                     |

Referência anterior: [redmine-adapter](https://github.com/CristenSoftwareDevelopment/redmine-adapter) (Flutter, código aberto),
que monitora consultas salvas por **contagem**. Serviu de base para: validação via `/my/account.json`, mensagens de erro de rede,
tentativas com espera crescente, janela de horário.

## 3. Stack e decisões

| Camada            | Escolha                                                                                                                | Por quê                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Shell desktop     | **Electron 44**                                                                                                        | Notificações nativas, bandeja, mesma base React; escolha do time (Tauri foi considerado) |
| Build             | **electron-vite 5** + **Vite 7**                                                                                       | Vite 8 exige `@vitejs/plugin-react@6` e Node mais novo; electron-vite 5 aceita Vite ≤ 7  |
| Empacotamento     | **electron-builder 26**                                                                                                | `.dmg` (arm64 + x64) e NSIS `.exe`                                                       |
| UI                | React 19, Tailwind 4 (`@tailwindcss/vite`), lucide-react                                                               | —                                                                                        |
| Linguagem         | **TypeScript 5.9.3**                                                                                                   | O TS 7 (Go) não expõe a API usada pelo typescript-eslint; fixado em 5.9                  |
| Dados (interface) | TanStack Query 5                                                                                                       | cache, refetch, invalidação e atualização otimista                                       |
| i18n              | **i18next** + react-i18next                                                                                            | pt-BR (padrão) e en-US; chaves tipadas                                                   |
| Qualidade         | ESLint 9 (typescript-eslint, **eslint-plugin-boundaries**, react-hooks), Prettier (4 espaços, 120 colunas), **Vitest** | fronteiras de camada verificadas no lint                                                 |
| Kanban            | @dnd-kit/core                                                                                                          | arrastar e soltar com `DragOverlay`                                                      |
| Markdown          | react-markdown + remark-gfm                                                                                            | HTML cru é ignorado (seguro)                                                             |
| Node              | **20.19.5** (`.nvmrc`)                                                                                                 | electron-vite 5 exige `^20.19` ou `>=22.12`; o Node padrão da máquina é 20.3.1           |
| Persistência      | JSON em `userData` + `safeStorage`                                                                                     | sem dependências nativas                                                                 |

**Decisões importantes**

- **Todo o código em inglês** (identificadores, comentários, testes, logs, mensagens de erro). Português só nos valores de `shared/i18n/locales/pt-BR.ts`; dados reais do Redmine (nomes de status, campos) podem aparecer em testes e nas heurísticas de reconhecimento.
- **Clean Architecture + Ports & Adapters + DDD** (seção 4). O domínio é puro e testado; a interface não conhece o Redmine.
- Chamadas HTTP usam `net.fetch` do Electron no processo principal → sem CORS e respeita o proxy do sistema.
- `sandbox: true` + `contextIsolation`; a interface só acessa `window.bridge`, gerada a partir do contrato (sem canal genérico para o Redmine).
- `will-navigate` e `setWindowOpenHandler` bloqueiam navegação para fora do app; `openExternal` só aceita `http(s)`.
- Erros atravessam as camadas como **códigos** (`AppError`, ex.: `network.dns`, `redmine.rejected`) e viram texto só na apresentação.
- Notificações são gravadas como **fatos estruturados** (quem, o quê, de/para) e formatadas no idioma atual ao exibir.
- Identificador do app: `com.eduardoschork.refinedredmine` (electron-builder e `AppUserModelId`).
- Idioma padrão **pt-BR** (o macOS da máquina está em inglês; "Do sistema" existe como opção).
- Tema claro/escuro segue o sistema (tokens CSS em `styles.css`, `@theme inline` do Tailwind).

## 4. Arquitetura

### 4.1 Camadas (Clean Architecture)

```
             ┌──────────────── renderer (apresentação, atomic design) ────────────────┐
             │  pages → templates → organisms → molecules → atoms     hooks · lib      │
             └───────────────▲─────────────────────────────────────────┬─────────────┘
                             │ contracts (IPC tipado)                  │ usa domain (puro) e i18n
┌─────────── main (composition root + adaptadores de entrada: IPC, janela, bandeja) ───────────┐
│                                   infra (adaptadores de saída)                        │
│   Redmine HTTP · arquivos JSON · safeStorage · Notification do Electron · permissão macOS · i18n │
└────────────────────────────────────────────▲──────────────────────────────────────────────────┘
                                             │ implementa as portas
                              application (casos de uso + PORTAS)
                                             │
                                    domain (entidades, value objects,
                                     serviços de domínio — puro)
```

Regra de dependência (verificada por `eslint-plugin-boundaries`, veja `eslint.config.mjs`):

| Camada           | Pode importar                                                                |
| ---------------- | ---------------------------------------------------------------------------- |
| `domain`         | só `domain` (sem Node, Electron, React, i18n; o "agora" chega por parâmetro) |
| `application`    | `domain`                                                                     |
| `contracts`      | `domain`, tipos de `application/dto`                                         |
| `shared` (i18n)  | `domain`                                                                     |
| `infra`          | `domain`, `application`, `contracts`, `shared` (i18n)                        |
| `main`           | tudo exceto `renderer`                                                       |
| `preload`        | `contracts`                                                                  |
| `renderer/lib`   | `domain`, `contracts`, `shared` (i18n)                                       |
| `renderer/hooks` | `lib` + acima                                                                |
| `ui/atoms`       | `atoms`, `lib`                                                               |
| `ui/molecules`   | `atoms`, `lib`, `domain`, `contracts`, `shared` (i18n)                       |
| `ui/organisms`   | `molecules`, `atoms`, `hooks`, `lib`, …                                      |
| `ui/templates`   | `organisms` e abaixo                                                         |
| `pages`          | `templates` e abaixo                                                         |
| `app`            | tudo do renderer                                                             |

### 4.2 Pastas

```
src/
  domain/                     núcleo puro (DDD) — com testes *.test.ts ao lado
    shared/                   AppError (códigos), datas locais, texto
    redmine/                  entidades (Issue, Journal, Version…), IssueFilter (Specification), parseIssuesUrl (filtro por URL), relações, RedmineLinks, analyzeQueue
    sprint/                   Sprint, SprintConventions (VO), classifySprints/activeSprints/pickSprint
    board/                    Board (aggregate), regras: canDropOn, targetStatus, columnsFromStatuses, assertValidBoard, boardIssueFilter
    calendar/                 CalendarEvent (aggregate), Recurrence (VO), expansão, planSave/planDelete (este/seguintes/todos), findDueReminders, cores
    notification/             AppNotification (entidade, payload estruturado, sources), interpretJournal, permissão
    monitor/                  Monitor (aggregate: origem + eventos + horário), explainQueueExit, diffMembership, isWithinSchedule, MonitorStatus
    log/                      LogEntry (requisição HTTP | passo do monitor), summarizeLog
    update/                   Release, UpdateStatus, compareVersions, installerFor, changelogSection
    settings/                 Settings (aggregate), padrões, withDefaults, affectsMonitor; appearance (tema, paletas, destaque, contraste)
  application/
    ports/                    RedmineGateway, repositórios (Settings, Notification, MonitorState, Calendar), SecretStore, ActivityLog,
                              SystemNotifier, NotificationPermissionProbe, AppEventsPublisher, Clock, IdGenerator, Scheduler, LoginItem, Localization
    services/                 UpdateService (versões novas), MonitorService (ciclo) + monitor/: MonitorCycle (cache de históricos, deduplicação), mine-check, source-check, journal-notifications
    use-cases/                session, settings, issues (queries), boards, sprints, calendar (+ ReminderDispatcher), notifications
    dto.ts                    entradas/saídas dos casos de uso
    testing/fakes.ts          implementações em memória das portas (testes)
  infra/
    redmine/                  RedmineHttpClient (retry, timeout, erros → códigos) + HttpRedmineGateway (IssueFilter → parâmetros)
    persistence/              JsonFile (cache + escrita atômica + backup de corrompido), repositórios JSON, formatos em disco, ActivityLogFile (JSON Lines)
    electron/                 SafeStorageSecretStore, ElectronSystemNotifier, DesktopNotificationPermission, MainLocalization, login item
    system/                   relógio, UUID, timers
  contracts/api.ts            RefinedApi (contrato), API_METHODS (canais), AppEvents, Bridge, IpcResult
  shared/
    i18n/
        locales/                pt-BR.ts (fonte das chaves), en-US.ts (tipado com as mesmas chaves)
      format/                 notificações, erros, recorrência, lembretes, datas (DateFormatter)
  main/                       index (ciclo de vida), container (injeção de dependência), ipc-router, window, tray
  preload/                    ponte gerada a partir de API_METHODS → window.bridge
  renderer/src/
    app/App.tsx               sessão, idioma, providers e rotas
    lib/                      api (cliente do contrato), router, i18n (useI18n), query-keys, ids, cn, recent-issues, shortcuts, board-view-prefs
    hooks/                    session, reference, issues, boards, sprints, calendar (useDisplayItems), notifications (+ sync de eventos), activity-log
    ui/atoms/                 Button, IconButton (md/sm, tom danger), Kbd, Input/Select/AddSelect/Textarea, Switch, Badge, Avatar, ColorDot, ProgressBar, Overline, TextLink, StatusDot
    ui/molecules/             Field/ToggleField, Dialog, Toast, SearchInput, SegmentedControl, Card/Panel/StatTile/Alert/EmptyState/Property,
                              NavItem, RichText, RefreshButton, RemovableChip, ReminderPicker/ColorPicker/WeekdayPicker/HourSelect, PhaseBadge/DateCountdown,
                              Markdown, ClampedContent, IssueRow, IssueCard, issue-chips (PriorityChip/DueChip/VersionChip), SignalFilter, FilterChip, LinkedIssueList, Tabs, AttachmentTile, SearchResultList, StatusTag/StatusToneDot, DistributionBar/RankedBars, ScheduleFields
    ui/organisms/             Sidebar, search/ (QuickSearch, HomeSearch, useQuickSearch), IssueModal (+ provider: abrir tarefa e nova tarefa), IssueCreateDialog, IssueFieldEditors, BoardEditor, KanbanBoard, BoardFilters, IssueList, IssueLinks, IssueDetailTabs, attachments/ (IssueAttachments, AttachmentPreviewDialog), SprintCard, SprintIssuesDialog, SprintSetupForm,
                              NotificationList/Rows, NotificationPermission (gate + status), HomePanels, calendar/*, settings/sections + MonitorsSection,
                              monitors/ (MonitorEditor, MonitorEventsFields), SavedQuerySelect, FilterUrlField
    ui/templates/             AppShell, PageLayout, CenteredLayout
    pages/                    Home, Calendar, Sprints, Board, Notifications, Log, Settings, Onboarding
scripts/                      make-icons.mjs, sign-electron-dev.mjs, demo-redmine.mjs (Redmine falso para capturas), release.mjs (publicar versão)
docs/                         MANUAL.md (+ images/), REGRAS-DE-NEGOCIO.md, FUNCIONAMENTO.md, INSTALACAO.md, RELEASE.md
```

### 4.3 Padrões usados

- **Ports & Adapters**: toda saída do núcleo passa por uma porta (`application/ports`); o `main/container.ts` liga as implementações (injeção de dependência manual — único lugar que conhece classes concretas).
- **Repository**: persistência dos aggregates sem expor o formato em disco (os arquivos continuam compatíveis com as versões anteriores; notificações antigas viram payload `legacy`).
- **Specification**: `IssueFilter` descreve a busca; o adaptador traduz para a API REST.
- **Strategy**: formatação de notificação por tipo de payload; presets de repetição.
- **Observer**: `AppEventsPublisher` → janela, bandeja e cache da interface (`useAppEventsSync`).
- **Factory**: `createEvent`, `duplicateOccurrence`; **Iterator**: gerador de ocorrências da recorrência.
- **CQRS leve**: `IssueQueries`/`ReferenceDataQueries` (leitura, com cache) separadas dos casos de uso de escrita.
- **Atomic design** na interface, com as fronteiras também verificadas no lint.

### 4.4 Como adicionar uma funcionalidade

1. **Domínio**: regra pura + teste ao lado (`*.test.ts`). Nada de `new Date()` implícito — receba `now`.
2. **Porta** (se precisar de algo externo) em `application/ports`, e o **caso de uso** em `application/use-cases` (teste com `testing/fakes.ts`).
3. **Adaptador** em `infra/` e ligação em `main/container.ts`.
4. **Contrato**: método em `RefinedApi` + nome em `API_METHODS` (o preload e o roteador IPC se geram sozinhos).
5. **Interface**: hook em `renderer/src/hooks`, componente no nível certo do atomic design, textos em `shared/i18n/locales/pt-BR.ts` **e** `en-US.ts` (o tipo obriga).
6. `npm run check` (tipos + lint + testes) e atualizar este arquivo.

**Contrato IPC (`window.bridge`)**: `session.{get,login,logout}`, `settings.update`, `issues.{list,get,allowedStatuses,byIds,changeStatus,comment,search,edit,editOptions,customFields,tree,bulkEdit,nearby,commentAndChange,create}`,
`reference.{statuses,projects,priorities,trackers,savedQueries,timeActivities}`, `time.{forIssue,mine,team,log,edit,remove,repeatWeek}`, `overtime.{list,add,remove,setPaid}`, `timer.{status,start,pause,resume,stop,discard}`, `boards.{issues,save(board, notifications?),remove,move}`, `sprints.{list,stats,inspectProject}`,
`calendar.{list,save,remove}`, `notifications.{list,markRead,clear,test,permission,openSettings}`, `monitor.{status,runNow}`, `log.{list,clear}`, `updates.{status,check,setToken,testToken,download,install}`, `app.{openExternal,info,openDataFolder,supportReport}`, `notifications.confirm`;
eventos `notifications.changed`, `monitor.status`, `permission.changed`, `update.status`, `timer.status`, `navigate` (rota de tela ou `/issue?id=`, que abre a tarefa no detalhe).

**Dados locais** (`~/Library/Application Support/Refined Redmine` · `%APPDATA%\Refined Redmine`) — detalhes de formato, escrita e o que fica só em memória em [`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md) §5–§6

- `config.json`: URL, usuário, idioma, API key criptografada (`apiKeyEnc`), quadros, **monitores**, sprints, preferências. Os campos antigos `scopes`/`eventKinds`/`customQueries` são convertidos em monitores ao ler (`withDefaults`) e somem no próximo salvamento.
- `state.json`: marca d'água do monitor (`lastCheckAt`), notificações (máx. 300; `events`), fotos das consultas/fila, último resultado de entrega (`notify`).
- `logs/activity.log`: log técnico em JSON Lines (requisições e passos do monitor), até 5 MB.
- `overtime.json`: banco de horas extras (`entries`, `paidMonths`).
- `calendar.json`: compromissos (`events`) e lembretes já disparados (`fired`, limpos após 3 dias). Arquivo corrompido é renomeado para `<arquivo>.corrompido-<ts>`.

## 5. Funcionalidades implementadas

> Todas as regras de negócio estão reunidas em [`docs/REGRAS-DE-NEGOCIO.md`](docs/REGRAS-DE-NEGOCIO.md). O funcionamento interno (timers, ciclo do monitor, requisições, memória × disco, arquivos, segurança) está em [`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md). O manual do usuário está em [`docs/MANUAL.md`](docs/MANUAL.md).

### Conexão

- Onboarding com URL + API key; valida em `/my/account.json` e guarda o usuário (id, login, nome).
- Desconectar mantém quadros e preferências.
- **Tela de conexão** (`ConnectionForm`): endereço preenchido com o último usado e ajustado por `prepareBaseUrl` (mostra "Endereço usado"), mostrar/esconder a chave, link para "Minha conta", campos travados e "Conectando a host… N s" durante o pedido, aviso após 8 s, erro com sugestão por código (`loginErrorCode`), aviso some ao editar. Login com uma tentativa só (30 s).
- **Correção (2026-10-01)**: depois de um login certo a tela às vezes ficava minutos na conexão. `replaceSession` usava `queryClient.clear()`, que apagava também a entrada da sessão observada pela tela; agora remove só o resto do cache.

### Início (dashboard)

- Saudação, 4 indicadores: **na minha fila**, **paradas**, **atrasadas**, **notificações não lidas**.
- Cartões das sprints ativas (exceto planejadas).
- Painéis: minha fila (com contagem por status), paradas, prazos (vencidas + próximos 7 dias), últimas notificações.
- "Parada" = sem atualização há N dias (padrão 5, configurável) **ou** status que contém pausa/bloque/aguard/impedi.

### Sprints

- Projeto configurável; campos de data detectados pelo nome (`limite|dev` e `publica|lança|release|deploy`), com ajuste manual.
- Padrões de nome configuráveis (regex): sprint `^\d+\.\d+$`, correção `^\d+\.\d+\.\d+$`.
- Fases calculadas (`domain/sprint/sprint-classifier.ts#classifySprints`):
  - **Em desenvolvimento**: sprint aberta com o prazo dos devs mais próximo que ainda não venceu.
  - **Em homologação**: sprint aberta com prazo dos devs vencido e publicação futura.
  - **Publicação atrasada**: sprint aberta com publicação já passada.
  - **Planejada**: demais sprints abertas.
  - **Em produção**: a última sprint fechada já publicada.
  - **Correção**: `X.Y.Z` aberta. Fechadas = publicadas.
- Cartão: datas com contagem regressiva, progresso (fechadas/total), abertas e "minhas".
- Detalhe da versão: tarefas por status, filtros por responsável / só minhas, **Criar quadro desta versão**.
- Histórico das últimas publicadas e lista de agrupadores.

### Kanban

- Origens: atribuídas a mim · projeto (com/sem subprojetos) · consulta salva (lista recarregável, inclui as privadas do usuário) · **filtro do Redmine por URL** (com botão Testar) · **sprint** (fixa ou automática: em desenvolvimento, em homologação, correção aberta — troca sozinha de versão).
- **Notificações do quadro**: switch no editor cria um monitor com origem no quadro (entrou/saiu, mudança de coluna, comentário, menção…).
- Colunas configuráveis (cada uma agrupa N status); atalho "Uma por status".
- Arrastar muda o status via `PUT /issues/:id.json`; ao iniciar o arraste busca `allowed_statuses` e esmaece colunas proibidas pelo fluxo; atualização otimista com rollback e mensagem do Redmine.
- Raias por responsável, atualização a cada 60 s, até 500 tarefas.
- **Filtros rápidos** (`BoardFilters`, `FilterChip`; regras em `domain/board/quick-filter.ts`): busca + Responsável, Tipo, Situação e Versão com seleção múltipla e contagem por opção (`filterOptions`), "Sem responsável"/"Sem versão" (`NONE`). Valem para Quadro e Lista; os contadores de atenção contam depois deles; título mostra "X de Y tarefas".
- **Lista** (`IssueList`; regras em `domain/board/issue-list.ts`): colunas como a lista do Redmine (#, tipo, situação, prioridade, título, responsável, versão, previsão), cabeçalho que ordena (`sortIssues`, `nextSort`; padrão prioridade decrescente, vazios no fim) e grupos recolhíveis (`groupIssues`: versão, situação, responsável, tipo ou nenhum). O cabeçalho fica fixo ao rolar (`sticky`): o cartão usa `overflow-clip` (com `overflow-hidden` ele vira o contêiner de rolagem do cabeçalho, que deixa de grudar) e o espaço acima dele é margem, não padding da área que rola (o `sticky` gruda abaixo do padding e as linhas apareciam na fresta).
- **Nova tarefa** no cabeçalho do quadro: abre o formulário com o projeto do quadro e, em quadro de sprint, a versão da sprint (`newIssueDefaults` em `domain/board/board-rules.ts`).
- **Preferências por quadro** (`lib/board-view-prefs.ts`, `localStorage` `refined-redmine.board-view.<id>`): modo (quadro/lista/resumo), filtros, agrupamento e ordenação; valores inválidos voltam ao padrão (`withQuickFilterDefaults`).
- Clique no card abre o **modal da atividade**.
- **Card** em linhas (`IssueCard`): número/tipo + etiqueta de prioridade; título; etiquetas (versão, previsão colorida por `dueState`, status quando a coluna junta vários, projeto quando o quadro tem vários); responsável + "há X" ou "parada há N dias". Borda esquerda vermelha/amarela para urgente/alta (`priorityLevel`, `PRIORITY_STRIPE`).
- **Sprint no resumo** (`SprintProgressPanel`, `sprintProgress` em `domain/sprint/sprint-progress.ts`): datas com contagem, ritmo (tempo passado × fechadas, tolerância 15 pontos), fechadas nos últimos 7 dias, abertas por dia útil até o prazo, tarefas criadas depois do início e estimativa das abertas. Início estimado no classificador (`devStart` = dia seguinte ao prazo dos devs da sprint anterior).
- **Resumo do quadro** (aba Quadro | Lista | Resumo, `BoardSummary`, `summarizeBoard` em `domain/board/board-summary.ts`): indicadores, distribuição por status na ordem das colunas (`DistributionBar`), tabela por pessoa (clique filtra o quadro), por tipo e por prioridade (`RankedBars`).
- **Cores das tarefas** (Configurações → Aparência, `IssueStyleSection`): cor por status, nível por prioridade e dias de "vence em breve"; guardado em `settings.issueStyle` (`domain/redmine/issue-style.ts`) e distribuído pela interface por `IssueStyleContext` (`lib/issue-style.tsx`), porque moléculas não usam hooks de dados.
- **Cores de status** inferidas pelo nome (`statusTone` em `domain/redmine/status-tone.ts`; tokens `--st-*` em `styles.css`; `StatusTag`/`StatusToneDot`): cabeçalho das colunas, cards, Início, detalhe e resumo.
- **Contadores de atenção** (`SignalFilter`, `countSignals`): atrasadas, prioridade alta, paradas, sem responsável; clicar filtra. Cabeçalho de coluna mostra atrasadas e altas da coluna. Regras em `domain/redmine/issue-signals.ts`.

### Modal da atividade

- Abre de qualquer tela (`useOpenIssue()`), com pilha e "← voltar".
- Descrição em Markdown; `#1234` vira link e abre no próprio modal. Descrição longa aparece cortada em 25 linhas (`DESCRIPTION_VISIBLE_LINES`; molécula `ClampedContent`, que mede pela altura de linha do conteúdo e observa mudanças de tamanho; até 3 linhas a mais aparece inteira), com "Mostrar tudo", para as abas ficarem visíveis ao abrir.
- **Título e descrição editáveis**: lápis ao lado do título (`TitleEditor`: Enter salva, Esc cancela) e "Editar" na descrição (`DescriptionEditor`: Markdown cru, ⌘/Ctrl+Enter salva, Esc não fecha o modal). Vão pelo mesmo `issues.edit`; o título é salvo sem espaços nas pontas e a descrição é comparada sem `\r\n` e linhas em branco finais (`comparableText`).
- **Abas** abaixo da descrição (`IssueDetailTabs`, molécula `Tabs` com setas do teclado e `role=tab`/`tabpanel`): Tarefas relacionadas (padrão, volta a ela a cada tarefa aberta), Anexos e Horas, uma renderizada por vez; contagem ou horas lançadas ao lado do nome.
- **Anexos** (aba, `attachments/IssueAttachments` + `AttachmentPreviewDialog`, cartão `AttachmentTile`; regras em `domain/redmine/attachment-kind.ts`; `AttachmentUseCases`): tipo pela extensão, miniatura de imagens até 5 MB, imagens e texto vistos no app (imagem em `data:` com tipo lido dos bytes, JSON indentado, setas entre anexos), **vídeo e áudio tocados no app** até 100 MB (MP4/MOV/M4V/WebM, MP3/WAV/OGG/M4A/AAC/FLAC; bytes pelo IPC → `blob:` criado na tela, CSP `media-src blob:`, `MediaPlayer` avisa quando o codec não toca), documentos, MKV/AVI e o resto da mídia no app do sistema (`TempFileOpener` grava em `userData/opened-attachments`, apagada ao iniciar e sair), compactados e o resto no Redmine. Nunca abre no sistema o que executa (programas, scripts, páginas, SVG, Office com macro). Download pelo id (`/attachments/download/:id`) sem seguir redirecionamento e com limite de tamanho (`RedmineHttpClient.download`).
- Histórico (notas + alterações), observadores, campos personalizados.
- **Imagens no meio do texto** (descrição e notas; `InlineAttachment` em `attachments/`, regra `findInlineAttachment`): `![](print.png)` ou link `/attachments/123` que aponta para um anexo da tarefa vira miniatura de até 8 rem (imagens até 5 MB; o resto vira etiqueta com o nome) e o clique abre a mesma visualização da aba Anexos. Antes o link relativo ia para `<redmine>/print.png`, página quebrada. O `Markdown` (molécula) recebe `renderImage`; imagem que não é anexo continua link.
- **Subtarefas e relações** (`IssueLinks`, linhas em `LinkedIssueList`; regras em `domain/redmine/linked-issues.ts`): número, título, status e responsável de cada uma, carregados numa só listagem (`issues.byIds` → `issuesByIds` em `application/use-cases/issue-lookup.ts`, também usado por Minhas horas). Relações agrupadas por tipo (bloqueadas primeiro, sentido correto por `relationFrom`), subtarefas com "N de M fechadas". A chave do cache fica sob a da tarefa (`qk.linkedIssues`), então atualizar a tarefa atualiza as ligadas.
- Ações: trocar status (entre os permitidos), comentar, **Abrir no Redmine**.
- **Ações rápidas** abaixo das etiquetas (`IssueQuickActions`, formatos em `domain/redmine/issue-copy.ts`): **Atribuir a mim** (via `issues.edit`, escondido quando já é do usuário) e copiar link, número, título, `#número título` e link Markdown.
- Lateral editável (`IssueFieldEditors` → `issues.edit` → `EditIssueFieldsUseCase`): tipo (trackers do projeto, `listProjectTrackers`), estimativa e tarefa pai (`CommitField`: salvos ao sair do campo), prioridade, responsável (membros do projeto; seletor `PickList` que só troca com clique no nome), versão (não fechadas), início, previsão e % concluído. Um campo por `PUT`; depois a tarefa é relida e os campos que o Redmine ignorou (fluxo só leitura) viram aviso (`ignoredFields`). Validação no domínio: `domain/redmine/issue-edit.ts`.

### Criar tarefa

- `IssueCreateDialog`, aberto por `useNewIssue()` (contexto no `IssueModalProvider`, como `useOpenIssue`): botão ao lado de Buscar na barra lateral, **⌘N/Ctrl+N** (`useModifierShortcut` em `lib/shortcuts.ts`, o mesmo do ⌘K), **Nova tarefa** no cabeçalho dos quadros e **Nova subtarefa** no detalhe (`subtaskDefaults`). Sem padrões explícitos, usa os da tela aberta: o quadro registra projeto e sprint com `useScreenIssueDefaults`. Depois de criada, a tarefa abre no modal (e a pai é relida).
- Campos: projeto (`PickList` com busca), tipo, título, descrição (Markdown), anexos, prioridade, responsável, versão, tarefa pai (título conferido ao sair do campo), início, previsão e estimativa (`parseHours`). Tipos, membros e versões vêm de `issues.editOptions(projectId)` (agora com `trackers`); trocar o projeto limpa os três.
- **Anexos** (`AttachmentPicker` com `AttachmentTile`, os mesmos cartões da aba Anexos; `UploadPreviewDialog` reaproveita `PreviewFrame`/`PreviewContent`): escolher, arrastar ou colar; bytes lidos ao adicionar, miniatura `data:` até 5 MB e visualização por `previewFromBytes` (domínio, também usado por `AttachmentUseCases`). Na criação: `assertValidUploads` (10 arquivos, 20 MB) → `POST /uploads.json` por arquivo (`RedmineHttpClient.upload`, corpo binário, 120 s) → `POST /issues.json` com os tokens.
- **Campos personalizados** (`CustomFieldInputs`, regras em `domain/redmine/custom-fields.ts`): `issues.customFields(projectId)` → `IssueQueries.customFields` lê as 100 tarefas mais novas do projeto e `projectCustomFields` monta os campos de cada tipo, com os valores usados como sugestão (`<datalist>`). Obrigatório (`*`) = preenchido em todas as recentes do tipo (com 3+); caixas 0/1, campos de várias opções e campos sempre vazios ficam de fora; tipo sem tarefas recentes recebe todos, sem `*`. Vão em `custom_fields` só os do tipo escolhido e preenchidos (`customFieldEntries`); a subtarefa herda os da pai (`inheritedCustomFields` em `subtaskDefaults`). O Redmine continua validando (lista com valor fora das opções → 422 com a mensagem dele).
- Padrões: projeto do quadro → projeto das sprints → primeiro projeto; tipo e prioridade mostram o padrão do Redmine até o usuário escolher.
- `issues.create` → `CreateIssueUseCase` (`assertValidNewIssue` em `domain/redmine/issue-edit.ts`) → `POST /issues.json`, uma tentativa só. Sem `<form>`: Enter no título não cria (no Redmine da empresa quem cria não exclui).

### Abas

- Inspiradas no redmine-adapter (§8, estudo de 2026-10-22). Cada tela e cada quadro abrem numa aba (`WorkspaceTabBar`, organismo no topo da área principal, que também é a barra de título arrastável do macOS); clicar no menu traz a aba para a frente ou abre uma no fim. Regras puras em `lib/workspace-tabs.ts` (`tabKey`, `openTab`, `closeTab`, `stepTab`, `tabAt`, `keepTabs`, `routePath`) com teste; estado em `hooks/workspace.ts` (`useWorkspaceTabs`), que substitui o antigo `useState<Route>` do `App.tsx`. O `NavContext` continua o mesmo: toda navegação abre ou foca uma aba.
- Abas escondidas ficam montadas (`TabPanel` com `hidden`), então guardam filtros, rolagem e formulários; `ActiveTabContext`/`useIsActiveTab` impede que respondam ao teclado (a Agenda é a única tela com atalhos globais). Modal da tarefa, busca e editor de quadro continuam globais, por cima de todas.
- Fechar: × ou clique do meio. Teclado: Ctrl+Tab/Ctrl+Shift+Tab e ⌘/Ctrl+1…9 (`useTabShortcuts`). O ⌘W não foi usado porque o menu padrão do Electron no macOS fecha a janela com ele.
- Configuração em `settings.workspace` (`tabs`, `restoreTabs`; Configurações → Geral → Abas). As abas abertas ficam no `localStorage` (`refined-redmine.workspace-tabs`, por computador); a agenda volta em hoje. Sem abas, cada navegação troca a única tela, como antes.
- Também: arrastar para reordenar (`moveTab`, arrastar nativo do HTML), botão direito com Duplicar / Fechar / Fechar as outras (`openNewTab`, `closeOtherTabs`; a chave da cópia é `<tela>#2`), e ⌘/Ctrl-clique ou clique do meio no menu para abrir em aba nova (`NavigateOptions.newTab`, `NavItem`). Abas reabertas guardam a posição da aba da frente (`activeIndex`).

### Trâmites (automações)

- Inspirados no redmine-adapter (§8). Regras em `settings.handoffRules` (Configurações → Automações, `HandoffRulesSection` + `HandoffRuleEditor`), regras puras em `domain/automation/handoff.ts`. Dois modos: `same` (na própria tarefa, `TramiteDialog`) e `other` (para outra tarefa, `HandoffDialog`). Botões em `handoff/HandoffButtons` na linha de ações do detalhe (`rulesFor` por tipo e situação) + **Novo trâmite** sempre (`NEW_TRAMITE_RULE`) + `SendNoteButton` em cada nota do histórico.
- Processo principal: `issues.nearby` → `findNearbyIssues` (busca em largura pelas vizinhas, com histórico, até 60 leituras) e `issues.commentAndChange` → `CommentAndChangeUseCase` (anexos + comentário + situação/responsável/versão num `PUT`, relê e devolve o que foi ignorado). Fechamento usa `issues.bulkEdit`; horas usam `time.log` e `overtime.add`. `reference.trackers` (`GET /trackers.json`) alimenta o editor.
- Envio em passos retomáveis: `lib/steps.ts` (`useSteps`, chaves por passo, repetir pula os concluídos), `StepsFooter` e `StepIcon` (moléculas) — os mesmos do Alterar em massa.
- Ficou de fora (anotado em §8): horas sugeridas pelo expediente (aqui as horas são digitadas), ações "Claude Code" e ícone por regra.

### Alterar em massa

- `BulkEditDialog` (botão na linha de ações do detalhe): árvore por `issues.tree` → `loadIssueTree` (raízes numa listagem, subtarefas por `parent_id` até 3 níveis; `domain/redmine/issue-tree.ts`), caixas que marcam a subárvore, situação/responsável/versão com "Manter", e um passo por tarefa via `issues.bulkEdit` → `BulkEditUseCase` (só o que difere, relê e marca ⚠ o que o Redmine ignorou). `Issue.parent` passou de `IssueDetail` para `Issue` (a listagem também traz).

### Horas extras e tempo do time

- **Horas extras** (rota `overtime`, `pages/OvertimePage.tsx`): banco só no app em `overtime.json` (`JsonOvertimeRepository`, `OvertimeUseCases`, contrato `overtime.{list,add,remove,setPaid}`; regras em `domain/time/overtime.ts`). Também alimentado pelo campo "Hora extra (destas horas)" do `TimeEntryDialog` e dos trâmites.
- **Tempo do time** (rota `team`, `pages/TeamTimePage.tsx`): times em `settings.teams` (`TeamEditorDialog`, membros por `issues.editOptions(projectId).assignees`), horas por `time.team` → `TimeQueries.team` (um `listTimeEntries({ userId })` por pessoa); grade, médias e agrupamento em `domain/time/team.ts`. "Meu tempo" é virtual.

### Busca rápida

- `⌘K`/`Ctrl+K` em qualquer tela ou botão **Buscar** no menu (`QuickSearch`, atalho em `App.tsx`); no Início, a mesma busca como campo abaixo da saudação (`HomeSearch`).
- Peças: `useQuickSearch` (texto, resultados, teclado; `ui/organisms/search/`), `SearchResultList` (molécula com seções e linhas), `Kbd` (átomo), `lib/shortcuts.ts` (rótulo do atalho). A paleta e o campo do Início só mudam o invólucro.
- `#1234`/`1234` → tarefa por número; texto (2+ caracteres) → título em todos os status via `f[]`, até 20 (`domain/redmine/issue-search.ts`, `IssueQueries.search`).
- Também filtra quadros e telas (sem acento) e mostra as 8 tarefas recentes (`lib/recent-issues.ts`, no `localStorage`).

### Horas

- **Lançar** (`TimeEntryDialog`): data (atalhos hoje/ontem), horas em vários formatos (`parseHours`), atividade (última usada → padrão do Redmine; some com uma só) e comentário obrigatório. Seção "Horas" no detalhe (`IssueTimeSection`) com total × estimado e editar/excluir os próprios.
- **Cronômetro** (`TimerService` no processo principal, `state.json` → `timer`): um por vez, sobrevive a reiniciar, pausa em `suspend`/`lock-screen` e após 10 min ociosos (descontando o tempo fora). Barra lateral (`TimerWidget`) e bandeja (título "⏱ 0:42" no macOS, dica no Windows, pausar/retomar no menu). Parar abre o lançamento com as horas.
- **Minhas horas** (`TimePage`, rota `/time`): totais por dia, grade tarefas × dias (`buildTimesheet`), lançamentos da semana, lançar por número, repetir semana passada (`RepeatWeekUseCase`). Indicador "Horas hoje" no Início.
- Regras em `domain/time/` (`time-entry.ts`, `timer.ts`, `timesheet.ts`).

### Agenda

- Visões **Dia, Semana, Mês e Lista**; Hoje/anterior/próximo; minicalendário com marcação de dias ocupados; linha da hora atual; título do período.
- Criar: botão Criar, atalho `c`, clique num horário (duração padrão) ou **arrastar** na grade para escolher o intervalo (passos de 15 min); clique num dia do mês cria evento de dia inteiro.
- Compromisso: título, início/fim, dia inteiro, vários dias, **cor** (11 cores do Google), local (link clicável), descrição, **vínculo com tarefa do Redmine** (abre o modal da tarefa).
- **Repetição** (`domain/calendar/recurrence.ts`): todos os dias, dias úteis, semanal (vários dias), mensal no dia N, mensal na Nª/última <dia da semana>, anual, e personalizada: a cada N dias/semanas/meses/anos, termina nunca / em data / após N ocorrências. Meses sem o dia (31) e 29/02 são pulados, como no Google.
- Editar/excluir evento recorrente: **Este evento / Este e os seguintes / Todos** (exceções por data; "seguintes" divide a série, inclusive com contagem; "todos" desloca a série pela diferença de datas).
- **Lembretes**: vários por compromisso (na hora, 5/10/15/30 min, 1/2 h, 1/2 dias, 1 semana, personalizado); dia inteiro conta a partir de um horário padrão (9h). Disparados pelo processo principal (funciona com a janela fechada); atraso de até 10 min ainda dispara; cada lembrete dispara uma vez. Clique na notificação abre a agenda no compromisso. Ficam no histórico de notificações (switch "Lembretes da agenda").
- **Camadas do Redmine** (somente leitura, liga/desliga): prazo dos devs e publicação das sprints (cor por fase) e prazos das minhas tarefas.
- Detalhes ao clicar (editar, duplicar, excluir), **busca** (mostra a próxima ocorrência), atalhos `c t d w m a n p j k ←/→`.
- Configurações: semana começa dom/seg, duração padrão, lembretes padrão (com horário e dia inteiro), horário dos lembretes de dia inteiro. A última visão usada é lembrada.
- Início: painel **Agenda de hoje** (compromissos + camadas).

### Notificações e monitores

- Monitor a cada 60 s (mínimo 30), com a janela fechada (bandeja) e opção de abrir no login.
- **Monitores** (Configurações → Monitores): cada um tem origem, eventos ligados/desligados e horário próprio opcional.
  - **Minhas tarefas** (fixo): escopos atribuídas/observadas/criadas; eventos nova tarefa, atribuída a mim, status, comentário, menção (`@login`), outras alterações (desligado), **saiu da fila**.
  - **Consulta salva**, **filtro por URL** e **quadro**: eventos entrou, saiu, atribuída, status, comentário, menção, outras. No quadro, mudança de coluna aparece como "moveu de A para B".
- A mesma alteração vista por dois monitores vira uma notificação só, com "via <monitor>".
- **Saída da fila**: tarefa que estava aberta e atribuída a mim e foi passada para outra pessoa ou fechada; a mensagem diz quem fez e para quem foi.
- Mudanças feitas pelo próprio usuário não notificam (inclusive entradas/saídas). Primeira execução só grava a marca d'água e as fotos.
- Mais de 4 eventos num ciclo → uma notificação resumida.
- Janela de horário geral, som, contador na bandeja/Dock, histórico com lidas/não lidas; lembretes da agenda no histórico é opcional.
- **Clique numa notificação de tarefa abre a tarefa no app** (`openNotification` em `lib/router.ts` para Início e Notificações; `openNotificationTarget` no `container.ts` para a do sistema, que manda `navigate` com `issueRoute`). Usa o `issueId` gravado, então vale também para as notificações antigas com o link do Redmine; `useAppEventsSync` roda dentro do `IssueModalProvider` (componente `AppEventsSync` no `App.tsx`) para poder abrir o modal.
- **Permissão**: ao abrir, verifica e mostra modal se pendente/bloqueada; Configurações mostra o estado e tem "Enviar notificação de teste".

### Aparência

- **Escala de texto** em `styles.css` (`@theme`: `text-2xs` 11,5 px … `text-3xl` 28 px); nenhum tamanho em px solto nos componentes. Botões não quebram texto (`whitespace-nowrap`); `IconButton` 36 px com borda e ícone de 17 px (`sm`: 28 px, sem borda, em diálogos e linhas). `--muted` mais claro no escuro e mais escuro no claro, para contraste.
- Atualizações: intervalo da verificação automática configurável (`updates.intervalHours`: 1, 4, 12, 24 ou 168 h).
- Configurações divididas em abas: **Geral**, **Aparência**, **Notificações**, **Agenda**, **Sprints e Início** (a rota aceita `/settings?tab=`).
- **Aparência**: tema (do sistema / claro / escuro, via `nativeTheme`), paleta por tema (claro: Padrão, Papel; escuro: Grafite, Meia-noite, Preto), cor de destaque (8 predefinidas, seletor de cor ou código hex; texto preto/branco pelo contraste), tamanho da interface (90–125%), reduzir animações, prévia e restaurar padrão. Detalhes em `docs/FUNCIONAMENTO.md` §9.

### Atualizações

- **Configurações → Geral → Atualizações**: o repositório é público e o app consulta as Releases sem token (60 consultas por hora por rede); um token do GitHub é opcional, só para quem esbarrar no limite (`update.rateLimited`), salvo criptografado, com **Testar** e remover. Verificação automática (30 s após abrir + no intervalo escolhido, desligável) e **Verificar agora**. Até a 0.9.0 o repositório era privado e o token era obrigatório.
- Versão nova → aviso na barra lateral + notas da Release; **Baixar**; Windows: **Reiniciar e atualizar** (instalador silencioso e reabre); Mac: **Abrir instalador** (abre o `.dmg` e fecha o app).
- **O que há de novo**: uma vez por versão, com o CHANGELOG embutido.
- Publicação: `npm run release` com o token de quem publica (`docs/RELEASE.md`). Detalhes em `docs/FUNCIONAMENTO.md` §8.

### Log

- Tela **Log** (barra lateral → App): cada requisição ao Redmine com horário, método, caminho + parâmetros, status, tempo, tamanho e tentativa; passos do monitor (verificação concluída, monitor ignorado/com falha/resultado parcial, limite de históricos).
- Indicadores (requisições, erros, tempo médio, transferido) calculados sobre o que está filtrado; filtros Tudo/Requisições/Monitor/Erros e busca por texto; atualiza a cada 5 s; **Apagar log**.
- Guardado em `logs/activity.log` (JSON Lines, até 5 MB, descarta os 40% mais antigos ao passar).

## 6. Como o monitor funciona

> Timers, requisições por ciclo, limites e comportamento com o computador em repouso: [`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md) §2–§4.

1. **Ciclo** (`MonitorService`): a cada `pollSeconds`, respeitando o horário geral. Monitores desligados perdem a foto (sem enxurrada ao religar); monitores fora do horário próprio são pulados. Cada monitor roda isolado: um erro vai para o status/Log e os outros continuam.
2. **Marca d'água** = maior `updated_on` visto por qualquer monitor (relógio do servidor). Sem marca (primeira vez), começa "agora".
3. **Minhas tarefas** (`mine-check.ts`):
   - Saída da fila primeiro: foto dos IDs abertos atribuídos a mim (`querySnapshots.__my_queue__`, até 500). Os que somem são lidos com `include=journals`; o journal que tirou de mim ou fechou explica a saída e não gera outro evento. Até 15 por ciclo.
   - Para cada escopo: `GET /issues.json?{escopo}=me&status_id=*&updated_on=>=<marca>&sort=updated_on:desc&limit=100`. Criada depois da marca por outra pessoa → "nova tarefa"; as demais têm os journals lidos.
4. **Consulta / filtro / quadro** (`source-check.ts`): busca a origem (até 500), compara os IDs com a foto anterior (entrou/saiu; com mais resultados, só a contagem) e lê os journals das tarefas com `updated_on` depois da marca. O Redmine ignora filtros extras com `query_id`, por isso a comparação de data é feita no app. Entradas/saídas cuja última mudança foi minha são descartadas.
5. **Journals** (`journal-notifications.ts`): cada journal novo de outra pessoa vira um evento, com o tipo mais importante ligado no monitor (menção > atribuição > status > comentário > outras). No quadro, status que troca de coluna vira "moveu de A para B".
6. **Ciclo compartilhado** (`MonitorCycle`): cada histórico é lido uma vez por ciclo (no máximo 40 somando todos os monitores) e notificações com a mesma chave (journal, criação, saída, entrada/saída de um monitor) são fundidas, acumulando as origens.
7. Fora da janela de horário a marca não avança, então o que aconteceu no período chega agrupado. Status como "Resolvida" e "Em teste" podem **não** ser fechados no Redmine (só os com `is_closed`).

## 7. Permissão de notificações no macOS (lições aprendidas)

- **O Electron do npm vem sem assinatura**, e o macOS descarta em silêncio as notificações de apps sem assinatura — o Electron ainda emite `show`. Solução: assinatura ad-hoc (`codesign --force --deep --sign -`), aplicada no `postinstall` (`scripts/sign-electron-dev.mjs`) e no build (`identity: '-'`).
- Em dev o app aparece como **Electron** (`com.github.Electron`) nos Ajustes.
- O Electron **não tem API** para consultar a permissão. No macOS 26, apps ad-hoc **não aparecem** em `com.apple.ncprefs`, e o banco `group.com.apple.usernoted/db2/db` é protegido (TCC).
- Estratégia atual (`infra/electron/notification-permission.ts`):
  1. sem assinatura → bloqueada;
  2. registro em `ncprefs` (lido com `defaults export`, que passa pelo cfprefsd) → `auth & 4` = alertas permitidos;
  3. senão, vale o **último resultado real** persistido: `show` = permitida, `failed` = bloqueada, nada = não solicitada.
- A interpretação de `auth` (1 = badge, 2 = som, 4 = alerta) foi inferida comparando apps da máquina; não é documentada pela Apple.
- **App instalado (0.1.0)**: é outro app para o macOS (`com.eduardoschork.refinedredmine`); as notificações dele vieram **desligadas** em Ajustes do Sistema → Notificações e precisaram ser ligadas à mão. Mesmo assim o Electron emite `show` e a tela mostrava "Permitidas" (o estado vem do último resultado salvo, compartilhado com o app de dev). Resolvido em 2026-09-29: o estado só é "Permitidas" com o registro do macOS ou com a confirmação do usuário após um teste (`resolvePermission`); sem isso, "Não confirmadas" e a janela de confirmação abre ao iniciar.
- Com a permissão bloqueada, "Verificar de novo" e voltar para a janela disparam uma notificação real de teste (só aparece se já estiver liberada).

## 8. Pendências e próximos passos

**Próximas funcionalidades**

- [x] Agenda com compromissos locais, recorrência e lembretes (2026-09-28).
- [ ] Agenda: arrastar compromisso para mover/redimensionar na grade.
- [ ] Agenda: barras contínuas para eventos de vários dias (hoje aparecem repetidos em cada dia).
- [ ] Agenda: "adiar" (soneca) na notificação do lembrete.
- [ ] Agenda: importar/exportar `.ics` e feed iCal; agenda compartilhada da empresa (exige backend ou arquivo em rede).
- [ ] Agenda: fuso horário por evento (hoje tudo é horário local "flutuante").
- [ ] Integração com o Mattermost (enviar notificações/DM, links de tarefas).
- [ ] **Mattermost: ociosidade de code review** (proposta de 2026-10-01, aguardando decisões do usuário). Ler o canal de review por token de acesso pessoal (no processo principal, como a chave do Redmine) e transformar cada mensagem em pedido: `@revisor`, autor, `#tarefa`/link do Redmine, links de PR do GitHub ("(back)"/"(front)"), prioridade pelo emoji (🔥 crítica, ⚡ alta, ⏳ média, 💤 baixa; sem emoji = média; aceitar também `:zap:` etc.). Avisar quando passar do limite sem sinal de review terminado (proposta: 1 h, 4 h, 1 dia útil, 3 dias úteis, só horário comercial). Tela "Code review" com os pedidos abertos. Testes só num Mattermost falso. **Em aberto**: (1) o que marca review terminado (reação, resposta na thread, status da tarefa no Redmine, PR aprovado/mergeado no GitHub); (2) limites e horário comercial; (3) avisar só o usuário ou painel do canal; (4) tokens de acesso pessoal liberados? endereço e canal.
- [x] Atualizações pelo GitHub Releases com o token de cada usuário (2026-09-29). Falta: instalação automática no Mac (exige Developer ID).
- [x] Edição de mais campos no modal: prioridade, responsável, versão, datas e % concluído (2026-09-29). Falta: horas estimadas.
- [x] Criar tarefa pelo app e editar título, descrição e tipo (2026-10-05).
- [x] Horas estimadas, tarefa pai e "Nova subtarefa", anexos na criação (cartões com miniatura e visualização) e atalho ⌘N (2026-10-06).
- [x] **Campos personalizados na criação** (2026-10-22): campos de cada tipo aprendidos das 100 tarefas recentes do projeto, com sugestões e `*` nos sempre preenchidos; subtarefa herda da pai. Falta: testar a criação no Redmine real (ver `NOTAS-INTERNAS.md`) e decidir se campos personalizados também ficam editáveis no detalhe.
- [ ] Observadores e categoria na criação: aguardando decisão (detalhes em `NOTAS-INTERNAS.md`).
- [x] Apontamento de horas (2026-10-01): lançar/editar/excluir no detalhe, cronômetro e "Minhas horas" (semana, grade, repetir semana passada), indicador "Horas hoje".
- [ ] Horas: meta diária (8 h?) e lembrete no fim do dia de quem não lançou — deixado de fora a pedido do usuário; ver se o time quer.
- [ ] Horas: coluna "Gasto" por pessoa no resumo do quadro (a lista de tarefas do Redmine não traz `spent_hours`; exigiria somar os lançamentos).
- [x] Busca global de tarefas (#id / texto), `⌘K`/`Ctrl+K` (2026-09-29).
- [ ] Monitores: intervalo de verificação próprio por monitor (como no redmine-adapter; hoje só o horário é próprio).
- [ ] Monitores: modelos de texto da notificação por monitor (o redmine-adapter tem `{queryName}`, `{diff}`…).
- [ ] Log: exportar/abrir a pasta do arquivo.
- [x] Monitor: verificar ao acordar o computador (`powerMonitor` `resume` → 10 s) e rodar os lembretes (2026-09-29).

**Segurança** (análise de 2026-09-29; detalhes do estado atual em [`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md) §11)

Já feito: janela com `sandbox` + `contextIsolation`; Markdown sem HTML bruto; navegação e janelas novas bloqueadas; `openExternal` só `http(s)`; credenciais só no processo principal com `safeStorage`; fuses e bloqueio de depuração no app instalado; atualização só de Releases e arquivos enviados por `TRUSTED_PUBLISHER`.

- [x] Electron fuses no build (sem RunAsNode, NODE_OPTIONS e --inspect; integridade do asar; só carrega do asar) e app instalado recusa depuração remota (2026-09-29).
- [x] Trocar os dados reais da empresa usados nos testes por fictícios.

_Prioridade 1 — próxima versão de correção (0.3.1), sem mudança visível:_

- [ ] **CSP por modo.** Hoje `connect-src 'self' ws:` vale também em produção e libera WebSocket para qualquer servidor (caminho de envio de dados para fora se algum código malicioso rodar na tela). Produção: `connect-src 'none'` (a tela não faz requisições), mais `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'`, `form-action 'none'`. Dev: só `ws://localhost:5173`. Plugin no `electron.vite.config` que escreve a política no `index.html`. Conferir no app gerado: imagens, "O que há de novo", temas.
- [ ] **Origem das chamadas IPC.** `registerApi` recusa chamadas cujo `event.senderFrame` não seja o frame principal da nossa página (`file://…/renderer/index.html` ou a URL do dev); erro `ipc.forbidden` + linha no log. Um lugar só, cobre todo o contrato.
- [ ] **Argumentos dos métodos que alteram algo** (~20: `issues.changeStatus/comment/edit`, `boards.*`, `calendar.*`, `settings.update`, `updates.setToken`, `session.login`…): conferir formato em tempo de execução (IDs inteiros, datas `AAAA-MM-DD`, textos com tamanho máximo). Hoje o processo principal confia nos tipos do TypeScript, que não existem em tempo de execução.
- [ ] **Log sem o que foi digitado.** O `activity.log` grava caminho + parâmetros, o que inclui o termo da busca rápida (`v[subject][]=…`) e filtros. Gravar os nomes dos parâmetros e ocultar os valores de texto livre.

_Prioridade 2:_

- [ ] **Criptografar `state.json` e o log** com `safeStorage` (migração automática do texto; o log criptografado linha a linha). Perder a chave do sistema não custa nada: os dois se refazem sozinhos. Ajuda principalmente em backups e sincronização (Time Machine, OneDrive, perfil móvel do Windows) e em pedidos de "me manda seus arquivos"; contra outro programa no mesmo usuário ajuda pouco (no Windows o DPAPI é por usuário).
- [ ] **Criptografar `calendar.json` só junto com exportar/importar a agenda.** Os compromissos só existem nesse arquivo; se a chave do sistema se perder (Keychain redefinido, senha do Windows trocada por um administrador, pasta copiada para outro computador), a agenda some. Sem um caminho de backup, fica em texto.
- [x] **Conferir o hash do instalador baixado** (2026-10-22): o SHA-256 é calculado durante o download e comparado com o `digest` que o GitHub informa para o arquivo; diferente → `update.checksum` e o arquivo é apagado. Releases antigas sem `digest` só conferem tamanho.
- [ ] **Não seguir redirecionamentos nas requisições da API** (como já é no download de anexos): o fetch mantém o cabeçalho `X-Redmine-API-Key` ao ser redirecionado para outro servidor. Seguir só para a mesma origem.
- [ ] Anexos: PDF dentro do app (exige `plugins: true` e liberar `frame-src blob:` na CSP, ou o pdf.js como dependência); tabela para CSV. Vídeo e áudio no app: feito em 2026-10-22 (`media-src blob:`).
- [ ] **Recusar Redmine em `http://`** fora de `localhost` (hoje aceito; a chave iria sem TLS).
- [ ] **Dependências:** `npm audit` no `npm run check` ou no release (falhar em "high"/"critical"), Dependabot no repositório e manter o Electron na versão com correções de segurança (hoje 44.x).

_Prioridade 3 / depende de decisão ou custo:_

- [ ] **Conta do GitHub é a raiz de confiança das atualizações.** Quem publicar uma Release como `eduardo-schork` instala código em todos os apps (no Windows, de forma silenciosa). Manter 2FA na conta e token de publicação fine-grained só deste repositório, guardado fora do disco.
- [ ] **Colaboradores têm escrita no repositório** (conta pessoal não tem "só leitura"): conseguem enviar código, mas não publicar Releases aceitas pelos apps. Se o time crescer, mover para uma organização com time de leitura, ou proteger o branch `master`.
- [ ] **Assinatura de código:** Developer ID + notarização no Mac (também listado mais abaixo) e certificado no Windows (SmartScreen avisa e o instalador silencioso roda sem assinatura verificada).
- [ ] **Conteúdo das notificações na tela de bloqueio:** opção de mostrar só "Nova atividade em #1234", sem título nem trecho (também em "Privacidade", abaixo).
- [ ] **Limpeza automática:** apagar notificações e log após N dias.
- [ ] **Erros inesperados no console** (`[ipc] …`, `console.error` com o objeto do erro): conferir que nenhum caminho imprime corpo de resposta ou dados do Redmine num log do sistema.

**Sugestões de configuração (a decidir, 2026-09-28)**

- [ ] Não perturbe: pausar notificações por 1 h / até amanhã / até desligar, pelo menu da bandeja e pelas Configurações.
- [ ] Filtro de ruído por monitor: ignorar alterações de certas pessoas (robôs, integrações) e de certos campos.
- [ ] Tela inicial escolhida pelo usuário (Início, um quadro, a agenda) e o que abrir ao clicar no ícone da bandeja.
- [ ] Início configurável: escolher e ordenar os painéis; esconder sprints que não são do meu time.
- [ ] Quadro: limite de cartões por coluna (WIP) com alerta, campos exibidos no cartão, ordenação (prioridade, data, atualização), densidade compacta.
- [x] Cores por status, inferidas pelo nome, com escolha do usuário por status e por prioridade (2026-09-30).
- [ ] Atalhos de teclado globais do sistema (abrir o app de fora dele) e editáveis. A busca rápida dentro do app já existe (`⌘K`).
- [ ] Formato de data e hora (24 h / 12 h, dd/mm) e fuso para exibição.
- [ ] Vários perfis de Redmine (trabalho, cliente) com troca rápida.
- [ ] Exportar/importar configurações (quadros, monitores, aparência) em um arquivo, para levar a outro computador ou compartilhar com o time.
- [ ] Privacidade: criptografar dados locais, apagar histórico/log automaticamente após N dias, esconder conteúdo das notificações na tela de bloqueio.
- [x] Diagnóstico: "Copiar informações de suporte" em Configurações → Geral → Sobre (2026-09-29).

**Suposições a confirmar com o time (2026-09-30)** — usadas no painel da sprint do resumo do quadro (`sprintProgress`); regras em `docs/REGRAS-DE-NEGOCIO.md` → Sprints.

- [ ] **Início da sprint**: o Redmine não tem data de início de versão; o app assume o dia seguinte ao prazo dos devs da sprint anterior (`assignDevStarts`) e mostra "Início (estimado)". Confirmar se é a regra do time ou se existe um campo de início na versão.
- [ ] **Feriados**: "para fechar por dia útil" conta de segunda a sexta (`workingDaysBetween`) e não desconta feriados. Avaliar uma lista de feriados (nacionais/da empresa) nas configurações.
- [ ] **O que conta como "fechada"**: resumo, ritmo e cartões de sprint contam só status com `is_closed` no Redmine. Decidir se "Finalizada", "Em aprovação" ou outros status abertos contam como concluídos (é a mesma questão da 3.78 aparecer 0/67, em "Melhorias conhecidas").

**Estudo do redmine-adapter (2026-10-22)** — app Flutter de código aberto (v0.2.0 de 15/10 e commit de 22/10), lido sem executar. Nenhuma checagem de papel/permissão lá: tudo funciona com a chave de qualquer membro e falhas de workflow são detectadas relendo a tarefa depois do `PUT`.

- [x] **Abas** (implementadas aqui, ver §5).
- [x] (2026-10-22) **Trâmite na própria tarefa** ("Novo trâmite"): um diálogo que junta comentário + anexos, situação, responsável, versão e lançamento de horas, executados em passos retomáveis (`update`, `time`…; repetir não comenta duas vezes) com confirmação "Isto vai mudar: Situação: A → B". Regras salvas com padrão de situação, responsável, atividade e modelo de comentário (`{{tarefa}}`, `{{titulo}}`), mostradas só em certos tipos/situações.
- [x] (2026-10-22) **Trâmite para outra tarefa (handoff)**: botão configurável que procura a tarefa destino nas vizinhas (pai, filhas, relações; busca em largura até 60 leituras) pelo tipo (ex.: Qualidade), deixa escolher notas a citar (`#1234#note-3`), monta o comentário por modelo (`{{tipoAtividadeComentario}}`, `{{noteSelecionado}}`), muda situação/responsável/versão no destino, lança horas na origem e fecha tarefas ligadas por tipo (`statusSteps`: tracker → situação). É o fluxo Dev → Qualidade → Negócio do time.
- [ ] **(Refino futuro, conversar com o usuário)** **Horas sugeridas pelo expediente**: "Contar desde" (última mudança de situação, último lançamento ou criação) até agora, dividido pelo horário comercial configurável (padrão seg–sex 8–12 e 13–18; almoço não conta) em horas normais e **hora extra**.
- [x] (2026-10-22) **Banco de horas extras** (local): lançamentos extras por dia/tarefa, mês "banco" ou "cobrar", saldo e gráfico de 12 meses.
- [x] (2026-10-22) **Tempo gasto do time**: times locais montados com membros dos projetos (sem admin), horas por pessoa × dia com total, média por pessoa e por dia útil, detalhe por tarefa ou por atividade, "Meu tempo". Só aparecem as horas que o papel do usuário pode ver.
- [x] (2026-10-22) **Alterar em massa**: árvore da tarefa (pai, relacionadas, subtarefas até 3 níveis) com caixas que marcam a subárvore; situação, responsável e versão aplicados só onde mudam (ex.: levar história e tarefas do backlog para a sprint).
- [ ] **Ações "Claude Code"**: botão por tipo/situação que abre `claude-cli://open?cwd=<pasta>&q=<prompt>` com modelo (ex.: `/review refs #{{numeroAtividade}}`) e, opcionalmente, muda a situação ao abrir. Não chama API de LLM.
- [ ] **Ordem única dos botões de automação** (arrastar) e ícone por ação.
- [ ] **(Refino futuro, conversar com o usuário)** Quadro "Ágil" embutido (projeto, minhas/todas, abertas/todas) sem consulta salva; menu ⋮ no card (abrir, editar, alterar situação, em massa, trâmite, ações); colunas escolhidas por quadro; raias por qualquer campo (versão, tipo, autor, categoria…).
- [ ] **(Refino futuro)** Monitor de consulta com regras de contagem (`= N`, `<= N`, `>= N` cruzando o limite, aumentou/diminuiu) e texto da notificação por modelo (`{queryName}`, `{previousCount}`, `{currentCount}`, `{diff}`, `{newCount}`, `{time}`, `{url}`).
- [ ] **(Refino futuro)** Editar campos personalizados no detalhe (lá: formato inferido das tarefas quando não é admin: 0/1 → caixa, data, número, lista quando há poucos valores repetidos).
- [ ] **(Refino futuro)** Barra lateral recolhível e redimensionável, quadros reordenáveis por arrastar; editor de notas com pré-visualização e barra de formatação.
- Não trazer: backup por área de transferência com a API key em texto puro (lá o JSON leva a chave).

**Proposta: telas e ações por papel do Redmine (a desenhar com o usuário)**

- Hoje nem o redmine-adapter nem o Refined Redmine olham papéis; erros de permissão aparecem depois (403/422 ou campo ignorado).
- Fonte possível sem admin: `GET /users/current.json?include=memberships` (projetos e papéis do usuário; `admin` vem junto) e `GET /roles/:id.json` (permissões do papel, ex.: `add_issues`, `edit_issues`, `log_time`, `view_time_entries`, `manage_versions`). Conferir no Redmine da empresa se `/roles/:id.json` responde para não admin.
- Desenho: porta `PermissionsGateway` + caso de uso que monta `Capabilities` por projeto (união das permissões dos papéis), em cache por sessão; o domínio mapeia funcionalidade → permissão exigida (`FEATURE_PERMISSIONS`). A interface esconde ou desabilita botões e telas por `useCan(feature, projectId)`.
- Configuração em dois níveis: o que o Redmine permite (automático) e o que o usuário quer ver (Configurações → Funcionalidades: ligar/desligar telas e ações, como as abas). Talvez perfis prontos por papel (Desenvolvimento, Qualidade, Negócio) para o time.

**Melhorias conhecidas**

- [ ] Progresso da sprint conta só status fechados; avaliar contar "Finalizada"/"Em aprovação" como concluída (a 3.78 aparece 0/67).
- [ ] Correções (`X.Y.Z`) não têm datas no Redmine — o cartão mostra "Sem datas definidas".
- [ ] Quadro de consulta salva/filtro: o Redmine aplica só os filtros da consulta, então colunas de status que a consulta exclui ficam vazias.
- [ ] Links `#1234` dentro de blocos de código também viram links.
- [x] Imagens embutidas na descrição e nas notas viram miniatura do anexo de mesmo nome (2026-10-22).
- [ ] Bundle da interface com ~1 MB (sem code splitting).
- [x] Testes automatizados (Vitest, 85 testes: domínio, casos de uso, adaptador Redmine, i18n), ESLint com fronteiras de camada e Prettier.
- [x] Repositório git no GitHub (`eduardo-schork/refined-redmine`), criado pelo usuário.
- [ ] Testes de componentes da interface (Testing Library) e de ponta a ponta (Playwright + Electron).

**Checklist da primeira versão (0.1.0 — piloto interno, macOS primeiro)**

Obrigatório antes de distribuir:

- [x] Chave que não pode ser descriptografada (ex.: dev → app instalado, outro Mac) leva de volta à tela de conexão (`SafeStorageSecretStore.hasApiKey`).
- [x] Testar com dados reais as ações de escrita: arrastar card, trocar status pelo modal, comentar (testado pelo usuário em 2026-09-28).
- [x] Testar os monitores contra o Redmine da empresa (testado pelo usuário em 2026-09-28).
- [x] (`.dmg` gerado em 2026-09-28: `dist/Refined Redmine-0.1.0.dmg` (Intel) e `-arm64.dmg` (Apple Silicon), ~130 MB cada; instalado pelo usuário e usado o dia inteiro em 2026-09-29 sem problemas; as notificações vieram desligadas nos Ajustes do macOS e foram ligadas à mão.) Gerar o `.dmg`, instalar em /Applications e testar o app instalado: primeira abertura (Gatekeeper com assinatura ad-hoc), permissão de notificação (outro bundle id que o dev), abrir no login, bandeja, pasta de dados.
- [x] Versão visível no app (Configurações → Geral → Sobre, com sistema e pasta de dados) e notas da versão (`CHANGELOG.md`).
- [x] Instruções de instalação para o time: `docs/INSTALACAO.md` (macOS e Windows).

Recomendado:

- [x] "Copiar informações de suporte".
- [x] Repositório remoto no GitHub, criado pelo usuário. Tag `v0.1.0`: a critério do usuário.
- [x] Dados reais da empresa nos testes trocados por fictícios.

Pode esperar: Developer ID + notarização (conta Apple Developer paga), atualização automática (no macOS exige app assinado com Developer ID).

**Distribuição**

- [x] Instalador do **Windows** (`dist/Refined Redmine Setup 0.1.0.exe`, gerado no Mac, sem assinatura: SmartScreen avisa) instalado e em uso pelo líder do time desde 2026-09-29, sem problemas relatados até agora.
- [x] Gerar e testar o `.dmg` instalado (`npm run dist:mac`).
- [ ] Certificado Apple Developer ID + notarização para eliminar o aviso do Gatekeeper (e permitir atualização automática no Mac).
- [x] Teste do token real contra o repositório privado no GitHub (Configurações → Atualizações → Testar), feito pelo usuário em 2026-09-29 no perfil de demonstração.
- [x] Primeira publicação pelo `npm run release` (0.2.0), feita pelo usuário em 2026-09-29 (`--draft` + revisão no GitHub + Publish).
- [ ] Ciclo automático completo: publicar uma 0.2.1 e conferir aviso, download e instalação nos apps já na 0.2.0 (Mac e Windows).
- [x] Publicação pelo GitHub Actions a cada push no `master` com `feat:`/`fix:` (2026-09-30): versão calculada pelos commits, CHANGELOG, instaladores Mac/Windows e Release publicada com o token do dono. Falta: o usuário criar o token, o environment `release` e o secret `RELEASE_TOKEN` (docs/RELEASE.md), e acompanhar a primeira execução.

**Agenda — verificado**

- Motor de recorrência testado com casos de borda (diário com salto, dias úteis, a cada 2 semanas, dia 31, última segunda, contagem, até data + exceção, 29/02, vários dias).
- Operações este/seguintes/todos (editar e excluir) testadas, inclusive divisão de série com contagem (5 → 2 + 3).
- Lembrete real disparado pelo app (evento de teste 5 min antes) e visões Semana/Mês/editor conferidas por screenshot. Compromissos de teste removidos.

**Não verificado com dados reais**

- [x] Monitores de consulta/filtro/quadro contra o Redmine da empresa (testados pelo usuário; antes validados com o Redmine falso `scripts/demo-redmine.mjs`, incluindo mudança de coluna, saída por filtro e fusão "via").
- [ ] Filtro por URL com os parâmetros `f[]`/`op[]`/`v[]` do Redmine real (o Redmine falso só entende parâmetros simples).

- [x] Arrastar card (mudança de status), comentar e trocar status pelo modal — testados pelo usuário.
- [ ] Notificação disparada por alteração real de outra pessoa (a saída da fila foi validada simulando a foto com uma tarefa real fechada por um colega).
- [ ] Saída por reatribuição (só o caminho "fechada" foi exercitado).

## 9. Desenvolvimento

```bash
nvm use                 # Node 20.19.5
npm install             # também assina o Electron de dev no macOS
npm run dev             # app com hot reload na interface
npm run typecheck
npm run lint              # ESLint (inclui as fronteiras entre camadas)
npm test                  # Vitest
npm run check             # tipos + lint + testes
npm run format            # Prettier
npm run dist:mac        # .dmg em dist/
npm run dist:win        # .exe em dist/
npm run sign:dev        # reassina o Electron de dev, se necessário
npm run icons           # regera ícones
```

- **Branches**: trabalho na `develop`; o `master` recebe merge da `develop` ou correção urgente, protegido por ruleset com bypass para o admin (o commit de release da Action usa o token do dono). Ver `docs/RELEASE.md` → Branches.
- **CI/CD**: `.github/workflows/ci.yml` roda `npm run check` em todo push e pull request; `release.yml` publica a versão sozinho e depois leva o `master` para a `develop` (job `sync-develop`: avança, ou faz commit de merge, ou para sem enviar se houver conflito; ver `docs/RELEASE.md`). As regras de versão ficam em `scripts/ci/release-rules.mjs` (testadas pelo Vitest junto com `src`).
- Mudanças no processo principal ou no preload exigem reiniciar o `npm run dev` (o hot reload só vale para a interface). Sintoma típico de esquecer: a tela fica em branco porque o processo principal ainda devolve dados no formato antigo (ex.: um campo novo de `Settings` ausente).
- Depuração: `npx electron-vite dev --remoteDebuggingPort 9333` expõe o DevTools Protocol (útil para prints e para chamar `window.api` por script).
- **Manual do usuário**: `docs/MANUAL.md`, com capturas em `docs/images/` (também publicado como Claude Doc compartilhável). Atualize o manual quando uma funcionalidade visível mudar.
- **Testar sempre no perfil de demonstração**, nunca no perfil real nem no Redmine da empresa. O app de dev sem `REFINED_REDMINE_USER_DATA` usa a mesma pasta do app instalado.
- **Testes de interface por script**: com o app aberto com `--remoteDebuggingPort 9334`, um script Node (`node --experimental-websocket`) conecta em `http://localhost:9334/json`, roda `Runtime.evaluate` na página (clicar, digitar, chamar `window.bridge.*`) e tira capturas com `Page.captureScreenshot`. Para campos controlados do React, altere o valor pelo setter nativo (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`) e dispare `input`/`change`. Foco programático sem a janela em foco não dispara `onFocus`: dispare também `focusin`.
- **Conferir o que foi escrito**: o `logs/activity.log` do perfil registra toda requisição (método, caminho, status, hora). Para saber se o app alterou uma tarefa, procure `"method":"PUT"` no horário. O Redmine falso não registra requisições.
- **Dados de demonstração** (para capturas sem expor tarefas reais): `node scripts/demo-redmine.mjs --seed <pasta>` sobe um Redmine falso em `http://localhost:4567` com dados fictícios e grava um perfil pronto na pasta; depois `REFINED_REDMINE_USER_DATA=<pasta> npx electron-vite dev --remoteDebuggingPort 9334` abre o app nesse perfil isolado, sem tocar no perfil real (a variável troca o `userData` antes do app ficar pronto).

## Histórico

| Data       | Mudança                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-28 | Criação do projeto: Electron + React; login por URL/API key; kanban com arrastar e soltar respeitando o fluxo; monitor de notificações por eventos e por consultas salvas; bandeja; configurações.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-28 | Sprints (fases, datas por campo personalizado, correções `X.Y.Z`), origem "sprint" no kanban (fixa/automática), modal de detalhes da atividade, painel Início.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-09-28 | Notificações no macOS: assinatura ad-hoc do Electron (causa das notificações descartadas), verificação de permissão ao abrir com modal, estado nas Configurações, notificação de teste.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-28 | Criação deste PROJECT.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-28 | Permissão de notificação passa a usar o último resultado real persistido (o Electron ad-hoc não aparece em `ncprefs` no macOS 26).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-28 | Novo evento **Saída de tarefa** (switch nas notificações): avisa quando uma tarefa sai da minha fila (reatribuída ou fechada), via foto da fila + journals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-09-28 | **Agenda**: visões dia/semana/mês/lista, recorrência estilo Google, lembretes com notificação do sistema, camadas de sprints e prazos, busca, atalhos, painel "Agenda de hoje". Correção em `Input`/`Select`: largura explícita (`w-*`) agora substitui o `w-full` padrão.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-28 | **Refatoração de arquitetura**: Clean Architecture + Ports & Adapters + DDD (domain/application/infrastructure/main/contracts), contrato IPC tipado no lugar do canal genérico `redmine.call`, i18n (pt-BR/en-US) com notificações e erros estruturados, atomic design na interface, ESLint com fronteiras de camada, Prettier e 67 testes (Vitest). TypeScript fixado em 5.9.3. Idioma configurável (padrão pt-BR).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-28 | Código 100% em inglês (comentários, identificadores, testes, logs); `infra` → `infra`; i18n movido para `src/shared/i18n`; app id `com.eduardoschork.refinedredmine`; chave da foto da fila passa a `__my_queue__` (a primeira verificação após a atualização só tira uma foto nova).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-28 | Passada de legibilidade no projeto inteiro: nomes autoexplicativos, sem ternário aninhado nem cadeias de if/else, rotinas longas quebradas em funções/componentes pequenos, comentários só de regra de negócio. Prettier com 4 espaços/120 colunas. ESLint passa a exigir `id-length` (mín. 2, exceto `t`/`_`), `no-nested-ternary`, `no-else-return`, `no-lonely-if`, `no-sequences`, `max-depth` 3 e `complexity` 12. Guia em CLAUDE.md → "Estilo de código".                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-28 | **Manual do usuário** (`docs/MANUAL.md` + capturas em `docs/images/`, também como Claude Doc). Redmine falso `scripts/demo-redmine.mjs` e variável `REFINED_REDMINE_USER_DATA` para um perfil isolado. Correção: o seletor de status do modal inclui o status atual quando o Redmine não o envia em `allowed_statuses` (antes exibia o primeiro status permitido).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-28 | **Monitores**: notificações passam a ser por monitor (minhas tarefas, consulta salva, filtro por URL, quadro), cada um com eventos e horário próprios; entrada/saída por foto de IDs, mudança de coluna nos quadros, fusão "via" entre monitores; migração automática das configurações antigas. **Filtro por URL** também como origem de quadro. **Notificações do quadro** no editor. Lista de consultas salvas sem cache (consulta recém-criada aparece; botão de recarregar). **Log** (tela + `logs/activity.log`) com tempo e tamanho das requisições. `docs/REGRAS-DE-NEGOCIO.md` reúne todas as regras.                                                                                                                                                                                                                                                                                         |
| 2026-09-28 | `docs/FUNCIONAMENTO.md`: processos, timers (monitor que se reagenda, lembretes a cada 20 s, atualização das telas), ciclo do monitor, requisições (timeout, tentativas, paginação), memória × disco, arquivos e segurança (credenciais, proteções, limitações). Pendências de segurança registradas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-28 | **Aparência**: tema claro/escuro/do sistema (`nativeTheme`), paletas (Padrão, Papel, Grafite, Meia-noite, Preto), cor de destaque personalizável com texto de contraste automático, tamanho da interface, reduzir animações. Configurações divididas em abas. Botões e destaques passam a usar o token `on-accent`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-09-28 | Preparação da 0.1.0: chave que não descriptografa volta para a tela de conexão (e a chave descriptografada fica em memória); **Sobre** em Configurações → Geral (versão, sistema, pasta de dados); `CHANGELOG.md`; dados reais da empresa nos testes trocados por fictícios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-09-28 | Primeiro `npm run dist:mac`: `electron-builder` 26 renomeou `nsis.allowToChangeInstallationDir` para `allowToChangeInstallationDirectory` (a validação falhava até no build do Mac). Gera `.dmg` Intel e Apple Silicon com assinatura ad-hoc, sem conta Apple.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-09-28 | Manuais atualizados: `docs/MANUAL.md` (instalação do `.dmg` com Gatekeeper/Keychain, notificações desligadas no app instalado, caminhos das abas de Configurações) e o manual online (Claude Doc) sincronizado com o projeto: filtro por URL, notificações do quadro, monitores, Log, abas de Configurações, Aparência, Sobre e novas perguntas frequentes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-09-29 | `npm run dist:win` no Mac gera o instalador NSIS do Windows (x64) sem ajustes; falta testar numa máquina Windows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-29 | MVP 0.1.0 em uso: o usuário usou o `.dmg` o dia inteiro sem problemas e o líder do time instalou o `.exe` no Windows e está usando, sem feedback negativo até agora. Bolinha de prioridade dos cards documentada no manual e nas regras.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-29 | Grupo 1 de acabamentos: permissão de notificação só "Permitidas" com prova (registro do macOS ou confirmação do usuário após o teste; `resolvePermission`, `notifications.confirm`, confirmação por cópia do app dev/instalado); verificação ao acordar (`powerMonitor` → `checkAfterWake`, lembretes na hora); "Copiar informações de suporte" (`app.supportReport`); `docs/INSTALACAO.md`. 95 testes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-29 | **Atualizações pelo GitHub Releases** do repositório privado, com o token clássico de cada usuário (quem tem acesso ao repositório recebe; os outros não): `UpdateService`, `GithubReleaseSource` (redirecionamento do download seguido à mão para não vazar o token), `DesktopInstaller`, token criptografado em `config.json`, seção Atualizações, aviso na barra lateral, **O que há de novo**. Nomes dos instaladores sem espaços (`refined-redmine-<v>-mac-<arch>.dmg`, `-windows-setup.exe`). `npm run release` + `docs/RELEASE.md`. Versão 0.2.0 (não publicada; publicação pelo usuário). 105 testes.                                                                                                                                                                                                                                                                                          |
| 2026-09-29 | Usuário testou no perfil de demonstração: grupo 1 (confirmação de notificações, suporte), seção Atualizações e teste de um token real com acesso ao repositório — tudo funcionando. Falta a primeira publicação (0.2.0).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-29 | Auditoria de segredos antes do push: nenhuma chave/token/senha no código, no histórico ou nos arquivos que o git envia. Correções: chave/token com caractere inválido recusados antes da rede e segredos removidos de mensagens de erro (`isWellFormedSecret`, `redactSecret`); atualizações só de Releases do dono do repositório (`TRUSTED_PUBLISHER`); builds com `--publish never` e sem `GITHUB_TOKEN`. 109 testes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-29 | Token fine-grained (`github_pat_…`) aceito e recomendado no app e nos docs (clássico como alternativa). Endurecimento: `electronFuses` no build e app instalado recusa `--remote-debugging-port`/`--inspect`. Falta conferir no primeiro build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-29 | **0.2.0 publicada** no GitHub Releases pelo usuário (`npm run dist:mac` + `dist:win`, `npm run release -- --draft --skip-build`, revisão e Publish). Lição: com `--skip-build`, os três instaladores precisam estar em `dist/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-29 | **Busca rápida** (`⌘K`/`Ctrl+K`: #id, título em todos os status, quadros, telas e 8 recentes) e **edição de campos** no detalhe (prioridade, responsável, versão, início, previsão, % concluído; relê a tarefa após salvar e avisa campos ignorados pelo Redmine). Portas novas `listProjectMembers` e `listPriorities`; demo com membros, prioridades, filtro `f[]` e versão só leitura em "Em teste". Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-29 | Busca também no **Início** (campo abaixo da saudação, `HomeSearch`). A busca rápida foi dividida em peças reaproveitáveis: `useQuickSearch`, `SearchResultList` (molécula), `Kbd` (átomo) e `lib/shortcuts.ts`; paleta e campo do Início usam as mesmas. Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-09-29 | Versão **0.3.0** preparada (busca rápida, busca no Início, edição de campos): `package.json`, `CHANGELOG.md`, commit e tag `v0.3.0`. Push e `npm run release` pelo usuário. É a primeira versão que deve chegar pelo ciclo automático a partir da 0.2.0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-29 | **Roadmap de segurança** detalhado em §8 (prioridades 1 a 3): CSP por modo, origem e argumentos do IPC, log sem termos digitados, criptografia de `state.json`/log (agenda só com exportar/importar), hash do instalador, `http://` recusado, auditoria de dependências, conta do GitHub como raiz de confiança, colaboradores com escrita, assinatura de código.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-30 | **Revisão da interface**: escala de texto com tokens (+1 px no geral), botões sem quebra de texto, `IconButton` maior e com borda, `--muted` com mais contraste. **Kanban**: card em linhas (prioridade em etiqueta e borda, etiquetas de versão/prazo, responsável e "parada há N dias"), contadores de atenção clicáveis e alertas por coluna (`issue-signals.ts`). **Início**: indicador de prioridade alta, números coloridos e clicáveis, prioridade nas listas. **Detalhe**: resumo com status, prioridade, prazo e versão. Notificação não lida com faixa de destaque. Testado no perfil de demonstração; capturas do manual refeitas.                                                                                                                                                                                                                                                          |
| 2026-09-30 | **Resumo do quadro** (aba ao lado do quadro): indicadores, distribuição por status, tabela por pessoa (clique filtra o quadro), por tipo e por prioridade. **Cores de status** inferidas pelo nome, nas colunas, cards, Início, detalhe e resumo. Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-30 | **Cores das tarefas** em Configurações → Aparência: cor de cada status, nível de cada prioridade e dias de "vence em breve" (`settings.issueStyle`). Corrigida corrida em que duas escolhas seguidas se sobrescreviam (cada gravação parte do último valor). Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-30 | **Sprint no resumo do quadro**: datas (início estimado, prazo dos devs, publicação), ritmo contra o calendário, fechadas em 7 dias, abertas por dia útil, escopo adicionado e estimativa restante. `Sprint.devStart` estimado pelo prazo da sprint anterior (suposição documentada nas regras). Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-30 | Versão **0.4.0** preparada (revisão da interface, cards, contadores, resumo do quadro com a sprint, cores das tarefas): `package.json`, `CHANGELOG.md`, commit e tag `v0.4.0`. Push e `npm run release` pelo usuário.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-30 | **Ações rápidas no detalhe da tarefa**: copiar link, número, título, "#número título" e link Markdown (`IssueQuickActions`, `copyText`). Testado no perfil de demonstração, conferindo o conteúdo da área de transferência.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-09-30 | **Atribuir a mim** nas ações rápidas do detalhe (um clique; some quando a tarefa já é sua; avisa se o Redmine não aplicar). Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-09-30 | Seletor de **responsável** só troca com clique no nome (`PickList`: digitar filtra; setas, Enter e letras no campo não mudam nada; Esc fecha só a lista), para evitar trocas acidentais. **Intervalo da verificação de atualizações** configurável (1 h a 1 semana). Guia de testes por script e de conferência do log em §9. Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-30 | Revisão de código antes da 0.5.0, com foco em vazamento de dados: nada novo registrado em log, nenhuma requisição nova, cópias só por clique; varredura de segredos e de dados da empresa nos arquivos do repositório limpa. Correções: `updates.intervalHours` validado também ao salvar (`cleanUpdates`), e a lista do `PickList` fecha enquanto o campo está desabilitado (evita segunda troca durante o salvamento).                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-30 | Versão **0.5.0** preparada (ações rápidas, Atribuir a mim, seletor de responsável só por clique, intervalo das atualizações): `package.json`, `CHANGELOG.md`, commit, tag `v0.5.0` e instaladores gerados. Push e `npm run release` pelo usuário.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-30 | **CI/CD no GitHub Actions**: `ci.yml` (verificação em todo push/PR) e `release.yml` (push no `master` com `feat:`/`fix:` → versão pelos commits, `Próxima versão` do CHANGELOG vira a versão, instaladores em runners macOS e Windows, commit + tag atômicos e Release publicada com `RELEASE_TOKEN` do environment `release`). Token só no job de publicação; versão passada por variável de ambiente. Simulado localmente num clone descartável.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-30 | **0.5.0 pulada** (commit e tag existem, sem Release; a seção `## 0.5.0` do CHANGELOG fica como está). A pipeline de CI/CD é a **0.6.0**, primeira versão pela Action, com notas próprias em `## Próxima versão` (que também resumem a 0.5.0 para quem vem da 0.4.0). Branch **`develop`** criada para o trabalho; `master` só com merge da `develop` ou correção urgente (proteção por ruleset documentada em `docs/RELEASE.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-01 | **Login**: corrigido o atraso de até minutos para abrir o Início depois de conectar (o log mostrava `/my/account` respondendo em 0,1–0,3 s e a tela parada; causa: `queryClient.clear()` em `replaceSession`). Tela de conexão nova com feedback (progresso, segundos, aviso de demora, erros com sugestão), endereço ajustado, login com uma tentativa, status HTTP antes do corpo de erro. Redmine falso passa a recusar chave diferente de `demo`. Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-01 | **Horas**: lançamentos no detalhe da tarefa (criar, editar, excluir os próprios), **cronômetro** no processo principal (barra lateral, bandeja, pausa ao dormir/bloquear e por ociosidade, sobrevive a reiniciar) e tela **Minhas horas** (semana, grade, repetir semana passada) + indicador "Horas hoje". Corrigido: `Esc` fechava todos os diálogos abertos de uma vez (agora só o de cima). Redmine falso com lançamentos e atividades. Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-01 | **Lista e filtros rápidos nos quadros**: aba **Lista** (como a lista de tarefas do Redmine, agrupada por versão, situação, responsável ou tipo, ordenável pelo cabeçalho, grupos recolhíveis; `domain/board/issue-list.ts`) e linha de **filtros rápidos** abaixo do título (busca, Responsável, Tipo, Situação, Versão, seleção múltipla; `domain/board/quick-filter.ts`), para quadro e lista. Cada quadro lembra modo, filtros, agrupamento e ordenação (`lib/board-view-prefs.ts`). Clicar numa pessoa no resumo filtra pelo id. Título com "X de Y tarefas" quando filtrado. Testado no perfil de demonstração; capturas `board-list.png` e `board-filters.png`.                                                                                                                                                                                                                                  |
| 2026-10-01 | **Subtarefas e relações no detalhe** com número, título, status e responsável de cada tarefa (antes só "Relacionada a #123"), carregados numa só listagem (`issues.byIds`); relações agrupadas por tipo, bloqueadas primeiro; subtarefas com "N de M fechadas"; fechadas com o número riscado. `issuesByIds` compartilhado com Minhas horas. Demo com relações e subtarefas na #1201. Proposta de **ociosidade de code review pelo Mattermost** anotada nas pendências. Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-01 | **Abas no detalhe da tarefa**: Tarefas relacionadas (padrão), Anexos e Horas em abas (`IssueDetailTabs`, molécula `Tabs`), uma por vez, com contagem ao lado do nome; o histórico continua abaixo. Testado no perfil de demonstração; capturas `modal.png`, `issue-links.png` e `time-issue.png` refeitas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-01 | **Anexos**: aba com cartões (miniatura ou ícone do tipo), imagens e texto vistos dentro do app com navegação pelas setas, documentos e mídia no app do sistema (arquivo temporário no perfil, apagado ao iniciar/sair), compactados e tipos executáveis só pelo Redmine. Tipo pela extensão e pelos bytes; download pelo id, sem redirecionamento e com limite. Demo com PNG, SVG, log, JSON, PDF e ZIP na #1201. Testado no perfil de demonstração (zip recusado pelo `open`).                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-01 | **0.7.0 publicada** pela Action. Novo job `sync-develop` no `release.yml`: depois de publicar, leva o `master` (commit de release) para a `develop` com o `RELEASE_TOKEN`, só com `git`; fast-forward quando possível, commit de merge quando a `develop` andou, e sem enviar nada em caso de conflito (resumo do job com as instruções). Simulado em repositórios descartáveis nos três casos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-05 | **0.8.0 publicada** pela Action (abas no detalhe, subtarefas e relações completas, anexos no app). Primeira execução do `sync-develop`: a `develop` foi avançada sozinha até o commit `chore: release 0.8.0` (develop = master = origin).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-10-05 | **Criar tarefa** pelo app (barra lateral e quadros, já no projeto e na sprint do quadro; `issues.create` → `POST /issues.json`) e **edição de título, descrição e tipo** no detalhe (`editOptions` traz os trackers do projeto). **Descrição longa** cortada em 25 linhas com "Mostrar tudo" (`ClampedContent`). **Notificações de tarefa abrem o detalhe no app**, na lista e no clique da notificação do sistema (rota `/issue?id=`). **Cabeçalho fixo** na Lista dos quadros (o `overflow-hidden` do cartão impedia o `sticky`). Redmine falso com criação, trackers por projeto, edição de texto e descrição longa na #1201. Testado no perfil de demonstração; capturas `modal.png` e `issue-new.png`. 231 testes.                                                                                                                                                                                |
| 2026-10-06 | **Criar tarefa, segunda parte**: anexos (escolher, arrastar ou colar; cartões iguais aos da aba Anexos com miniatura e visualização local, `previewFromBytes` no domínio), tarefa pai (com título conferido) e estimativa no formulário; **Nova subtarefa** no detalhe; estimativa e tarefa pai editáveis na lateral (`CommitField`); atalho **⌘N** com os padrões do quadro aberto (`useScreenIssueDefaults`). Upload em dois passos (`/uploads.json` + tokens). Investigação no Redmine real: campos personalizados obrigatórios por tipo; sem suporte a eles a criação falha (detalhes em `NOTAS-INTERNAS.md`). Redmine falso com uploads, estimativa e pai. 238 testes.                                                                                                                                                                                                                            |
| 2026-10-22 | **0.9.0 publicada** pela Action em 2026-10-06 (criar e editar tarefas, anexos na criação, subtarefa, ⌘N, descrição recolhida, notificações abrindo no app, cabeçalho fixo da Lista); `develop` = `master` = `origin` em `chore: release 0.9.0`. Ficou de fora: os campos personalizados obrigatórios por tipo, então criar tarefa pelo app ainda falhava em Redmines que os exigem (§8).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-22 | **Campos personalizados ao criar tarefa** (exigidos por tipo): formatos lidos de tarefas recentes do Redmine real (só leitura, a pedido do usuário); o app aprende campos e sugestões das 100 tarefas mais novas do projeto (`issues.customFields`, `projectCustomFields`), marca como obrigatório o que todas preenchem e a subtarefa herda da pai. **Vídeo e áudio tocam no app** (`media-src blob:`, `MediaPlayer`). **Imagens no meio da descrição e das notas** viram miniatura do anexo (`findInlineAttachment`, `InlineAttachment`), em vez do link quebrado. Redmine falso com campos personalizados obrigatórios por tipo (422 como o real), imagem na descrição e na nota da #1201 e vídeo fictício (`scripts/demo-assets/reproducao-erro-cep.webm`, gerado com canvas + MediaRecorder). Testado no perfil de demonstração; capturas `issue-new.png` e `issue-inline-image.png`. 250 testes. |
| 2026-10-22 | **Estudo do redmine-adapter** (app Flutter de código aberto; clonado e lido sem executar) com a lista de funcionalidades a avaliar e a proposta de permissões por papel (§8). **Abas** como no adapter: cada tela e cada quadro numa aba, estado mantido nas de trás, Ctrl+Tab e ⌘1…9, reabertas ao iniciar, configuráveis em Configurações → Geral → Abas (`settings.workspace`). Testado no perfil de demonstração; captura `workspace-tabs.png`. 257 testes.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-22 | **Trâmites** (regras em Configurações → Automações; na própria tarefa e para a tarefa vizinha com notas citadas, horas e fechamento; Novo trâmite sempre; envio em passos retomáveis), **Alterar em massa** (árvore pai/relacionadas/subtarefas), **Horas extras** (banco em `overtime.json`) e **Tempo do time** (times de membros de projetos, grade pessoa × dia). Abas com arrastar, duplicar, fechar as outras e ⌘-clique. Redmine falso com tipo Qualidade (#1220 ligada à #1201), `parent_id`, `/trackers.json`, anexos no `PUT`, lançamentos de colegas e regra/time de exemplo no perfil semeado. Testado no perfil de demonstração ponta a ponta (envio para QA conferido no Redmine falso e no `overtime.json`); capturas `handoff.png`, `bulk-edit.png`, `overtime.png`, `team-time.png`. 292 testes.                                                                                      |
| 2026-10-22 | **Preparação para repositório público**: o que é específico do Redmine da empresa (projeto, ids, campos, valores, pessoas, detalhes do estudo) saiu do PROJECT.md e dos docs para `NOTAS-INTERNAS.md` (no `.gitignore`); teste e Redmine falso com dados fictícios; CLAUDE.md com a regra. **Atualizações sem token** (token opcional, `update.rateLimited`) e **SHA-256 do instalador** conferido (`update.checksum`). Reescrita do histórico (e-mail corporativo dos commits e textos da empresa) preparada em `.publicacao/` para o usuário revisar antes do push.                                                                                                                                                                                                                                                                                                                                  |
