# Refined Redmine — base de conhecimento do projeto

> Documento vivo: registra o que existe, por que foi feito assim, o que falta e o que aprendemos.
> **Atualize este arquivo a cada mudança** (seção relevante + entrada no [Histórico](#histórico)).
> O `README.md` é o guia rápido de uso; este arquivo é a memória do projeto.

Última atualização: 2026-09-28

---

## 1. Visão

App desktop (macOS e Windows) que substitui o uso diário da interface do Redmine, que é arcaica, no dia a dia do time:
kanban de verdade, notificações nativas do sistema, visão de sprints, agenda com lembretes e um painel inicial.
Futuro: integração com o Mattermost (chat da empresa).

**Princípios**

- **Sem backend (por enquanto).** Cada pessoa informa a URL do Redmine e a própria API key; o app conversa direto
  com a API REST. Consequência: o monitor só roda enquanto o app está aberto (inclusive na bandeja).
- **O Redmine continua sendo a fonte da verdade.** O app só guarda localmente a configuração (quadros, preferências)
  e o estado do monitor.
- **A API key nunca chega à interface.** Toda chamada passa pelo processo principal.

## 2. Contexto da empresa (convenções do Redmine)

| Item              | Valor / regra                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Redmine           | versão ≥ 5 (aceita `include=allowed_statuses`)                                                                                   |
| Projeto principal | **Projeto principal**                                                                                       |
| Sprint            | versão `X.Y` (ex.: `3.78`), descrição `sprint-3.78`                                                                              |
| Correção          | versão `X.Y.Z` (ex.: `3.77.1`) = correções na **branch da qualidade / staging** da sprint `X.Y`; campo `hotfix` = `1`           |
| Agrupadores       | versões sem número (`backlog`, `backlog_sprint`, `backlog_futuro`, `site`, `site_futuro`, `projeto_x`) |
| Campos da versão  | `Prazo dos devs`, `Publicação`, `hotfix`                                       |
| Status relevantes | `1` Nova, `2` Em andamento, `8` Em pausa, `44` Em aprovação, `77` Análise rejeitada (entre outros)                               |
| Texto das tarefas | Markdown (descrições e PRDs usam `#`, tabelas, código)                                                                           |
| Ciclo da sprint   | desenvolvimento → _prazo dos devs_ → homologação → _publicação_ → produção                                                       |

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
    lib/                      api (cliente do contrato), router, i18n (useI18n), query-keys, ids, cn, recent-issues, shortcuts
    hooks/                    session, reference, issues, boards, sprints, calendar (useDisplayItems), notifications (+ sync de eventos), activity-log
    ui/atoms/                 Button, IconButton, Input/Select/AddSelect/Textarea, Switch, Badge, Avatar, ColorDot, ProgressBar, Overline, TextLink, StatusDot
    ui/molecules/             Field/ToggleField, Dialog, Toast, SearchInput, SegmentedControl, Card/Panel/StatTile/Alert/EmptyState/Property,
                              NavItem, RichText, RefreshButton, RemovableChip, ReminderPicker/ColorPicker/WeekdayPicker/HourSelect, PhaseBadge/DateCountdown,
                              Markdown, IssueRow, IssueCard, ScheduleFields
    ui/organisms/             Sidebar, search/ (QuickSearch, HomeSearch, useQuickSearch), IssueModal (+ provider), IssueFieldEditors, BoardEditor, KanbanBoard, SprintCard, SprintIssuesDialog, SprintSetupForm,
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

**Contrato IPC (`window.bridge`)**: `session.{get,login,logout}`, `settings.update`, `issues.{list,get,allowedStatuses,changeStatus,comment,search,edit,editOptions}`,
`reference.{statuses,projects,priorities,savedQueries}`, `boards.{issues,save(board, notifications?),remove,move}`, `sprints.{list,stats,inspectProject}`,
`calendar.{list,save,remove}`, `notifications.{list,markRead,clear,test,permission,openSettings}`, `monitor.{status,runNow}`, `log.{list,clear}`, `updates.{status,check,setToken,testToken,download,install}`, `app.{openExternal,info,openDataFolder,supportReport}`, `notifications.confirm`;
eventos `notifications.changed`, `monitor.status`, `permission.changed`, `update.status`, `navigate`.

**Dados locais** (`~/Library/Application Support/Refined Redmine` · `%APPDATA%\Refined Redmine`) — detalhes de formato, escrita e o que fica só em memória em [`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md) §5–§6

- `config.json`: URL, usuário, idioma, API key criptografada (`apiKeyEnc`), quadros, **monitores**, sprints, preferências. Os campos antigos `scopes`/`eventKinds`/`customQueries` são convertidos em monitores ao ler (`withDefaults`) e somem no próximo salvamento.
- `state.json`: marca d'água do monitor (`lastCheckAt`), notificações (máx. 300; `events`), fotos das consultas/fila, último resultado de entrega (`notify`).
- `logs/activity.log`: log técnico em JSON Lines (requisições e passos do monitor), até 5 MB.
- `calendar.json`: compromissos (`events`) e lembretes já disparados (`fired`, limpos após 3 dias). Arquivo corrompido é renomeado para `<arquivo>.corrompido-<ts>`.

## 5. Funcionalidades implementadas

> Todas as regras de negócio estão reunidas em [`docs/REGRAS-DE-NEGOCIO.md`](docs/REGRAS-DE-NEGOCIO.md). O funcionamento interno (timers, ciclo do monitor, requisições, memória × disco, arquivos, segurança) está em [`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md). O manual do usuário está em [`docs/MANUAL.md`](docs/MANUAL.md).

### Conexão

- Onboarding com URL + API key; valida em `/my/account.json` e guarda o usuário (id, login, nome).
- Desconectar mantém quadros e preferências.

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
- Raias por responsável, busca, filtro por responsável, atualização a cada 60 s, até 500 tarefas.
- Clique no card abre o **modal da atividade**.

### Modal da atividade

- Abre de qualquer tela (`useOpenIssue()`), com pilha e "← voltar".
- Descrição em Markdown; `#1234` vira link e abre no próprio modal.
- Anexos, subtarefas, relações (com sentido correto), histórico (notas + alterações), observadores, campos personalizados.
- Ações: trocar status (entre os permitidos), comentar, **Abrir no Redmine**.
- Lateral editável (`IssueFieldEditors` → `issues.edit` → `EditIssueFieldsUseCase`): prioridade, responsável (membros do projeto), versão (não fechadas), início, previsão e % concluído. Um campo por `PUT`; depois a tarefa é relida e os campos que o Redmine ignorou (fluxo só leitura) viram aviso (`ignoredFields`). Validação no domínio: `domain/redmine/issue-edit.ts`.

### Busca rápida

- `⌘K`/`Ctrl+K` em qualquer tela ou botão **Buscar** no menu (`QuickSearch`, atalho em `App.tsx`); no Início, a mesma busca como campo abaixo da saudação (`HomeSearch`).
- Peças: `useQuickSearch` (texto, resultados, teclado; `ui/organisms/search/`), `SearchResultList` (molécula com seções e linhas), `Kbd` (átomo), `lib/shortcuts.ts` (rótulo do atalho). A paleta e o campo do Início só mudam o invólucro.
- `#1234`/`1234` → tarefa por número; texto (2+ caracteres) → título em todos os status via `f[]`, até 20 (`domain/redmine/issue-search.ts`, `IssueQueries.search`).
- Também filtra quadros e telas (sem acento) e mostra as 8 tarefas recentes (`lib/recent-issues.ts`, no `localStorage`).

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
- **Permissão**: ao abrir, verifica e mostra modal se pendente/bloqueada; Configurações mostra o estado e tem "Enviar notificação de teste".

### Aparência

- Configurações divididas em abas: **Geral**, **Aparência**, **Notificações**, **Agenda**, **Sprints e Início** (a rota aceita `/settings?tab=`).
- **Aparência**: tema (do sistema / claro / escuro, via `nativeTheme`), paleta por tema (claro: Padrão, Papel; escuro: Grafite, Meia-noite, Preto), cor de destaque (8 predefinidas, seletor de cor ou código hex; texto preto/branco pelo contraste), tamanho da interface (90–125%), reduzir animações, prévia e restaurar padrão. Detalhes em `docs/FUNCIONAMENTO.md` §9.

### Atualizações

- **Configurações → Geral → Atualizações**: cada usuário cola o próprio token clássico do GitHub (escopo `repo`, conta com acesso ao repositório privado); **Testar**, salvar criptografado, remover; verificação automática (30 s após abrir + a cada 24 h, desligável) e **Verificar agora**.
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
7. Fora da janela de horário a marca não avança, então o que aconteceu no período chega agrupado. Status como "Resolvida" e "Em teste" **não** são fechados no Redmine da empresa (só "Finalizada" é).

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
- [x] Atualizações pelo GitHub Releases com o token de cada usuário (2026-09-29). Falta: instalação automática no Mac (exige Developer ID).
- [x] Edição de mais campos no modal: prioridade, responsável, versão, datas e % concluído (2026-09-29). Falta: horas estimadas.
- [ ] Apontamento de horas (time entries).
- [x] Busca global de tarefas (#id / texto), `⌘K`/`Ctrl+K` (2026-09-29).
- [ ] Monitores: intervalo de verificação próprio por monitor (como no redmine-adapter; hoje só o horário é próprio).
- [ ] Monitores: modelos de texto da notificação por monitor (o redmine-adapter tem `{queryName}`, `{diff}`…).
- [ ] Log: exportar/abrir a pasta do arquivo.
- [x] Monitor: verificar ao acordar o computador (`powerMonitor` `resume` → 10 s) e rodar os lembretes (2026-09-29).

**Segurança**

- [ ] Criptografar `state.json`, `calendar.json` e o log (hoje em texto; têm títulos, trechos de comentários e compromissos).
- [ ] Validar a origem das chamadas IPC (`event.senderFrame`) nos handlers.
- [x] Electron fuses no build (sem RunAsNode, NODE_OPTIONS e --inspect; integridade do asar; só carrega do asar) e app instalado recusa depuração remota (2026-09-29). Conferir no primeiro build que o app abre normalmente.
- [ ] CSP de produção sem `ws:` (hoje liberado por causa do recarregamento do dev).
- [x] Trocar os dados reais da empresa usados nos testes por fictícios.

**Sugestões de configuração (a decidir, 2026-09-28)**

- [ ] Não perturbe: pausar notificações por 1 h / até amanhã / até desligar, pelo menu da bandeja e pelas Configurações.
- [ ] Filtro de ruído por monitor: ignorar alterações de certas pessoas (robôs, integrações) e de certos campos.
- [ ] Tela inicial escolhida pelo usuário (Início, um quadro, a agenda) e o que abrir ao clicar no ícone da bandeja.
- [ ] Início configurável: escolher e ordenar os painéis; esconder sprints que não são do meu time.
- [ ] Quadro: limite de cartões por coluna (WIP) com alerta, campos exibidos no cartão, ordenação (prioridade, data, atualização), densidade compacta.
- [ ] Cores por status do Redmine (bolinha/borda no cartão e no modal).
- [ ] Atalhos de teclado globais do sistema (abrir o app de fora dele) e editáveis. A busca rápida dentro do app já existe (`⌘K`).
- [ ] Formato de data e hora (24 h / 12 h, dd/mm) e fuso para exibição.
- [ ] Vários perfis de Redmine (trabalho, cliente) com troca rápida.
- [ ] Exportar/importar configurações (quadros, monitores, aparência) em um arquivo, para levar a outro computador ou compartilhar com o time.
- [ ] Privacidade: criptografar dados locais, apagar histórico/log automaticamente após N dias, esconder conteúdo das notificações na tela de bloqueio.
- [x] Diagnóstico: "Copiar informações de suporte" em Configurações → Geral → Sobre (2026-09-29).

**Melhorias conhecidas**

- [ ] Progresso da sprint conta só status fechados; avaliar contar "Finalizada"/"Em aprovação" como concluída (a 3.78 aparece 0/67).
- [ ] Correções (`X.Y.Z`) não têm datas no Redmine — o cartão mostra "Sem datas definidas".
- [ ] Quadro de consulta salva/filtro: o Redmine aplica só os filtros da consulta, então colunas de status que a consulta exclui ficam vazias.
- [ ] Links `#1234` dentro de blocos de código também viram links.
- [ ] Imagens embutidas na descrição viram links (os anexos exigem sessão no Redmine).
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
- [ ] Opcional: publicar pelo GitHub Actions (build na nuvem ao criar a tag).

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

- Mudanças no processo principal ou no preload exigem reiniciar o `npm run dev`.
- Depuração: `npx electron-vite dev --remoteDebuggingPort 9333` expõe o DevTools Protocol (útil para prints e para chamar `window.api` por script).
- **Manual do usuário**: `docs/MANUAL.md`, com capturas em `docs/images/` (também publicado como Claude Doc compartilhável). Atualize o manual quando uma funcionalidade visível mudar.
- **Dados de demonstração** (para capturas sem expor tarefas reais): `node scripts/demo-redmine.mjs --seed <pasta>` sobe um Redmine falso em `http://localhost:4567` com dados fictícios e grava um perfil pronto na pasta; depois `REFINED_REDMINE_USER_DATA=<pasta> npx electron-vite dev --remoteDebuggingPort 9334` abre o app nesse perfil isolado, sem tocar no perfil real (a variável troca o `userData` antes do app ficar pronto).

## Histórico

| Data       | Mudança                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-28 | Criação do projeto: Electron + React; login por URL/API key; kanban com arrastar e soltar respeitando o fluxo; monitor de notificações por eventos e por consultas salvas; bandeja; configurações.                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-28 | Sprints (fases, datas por campo personalizado, correções `X.Y.Z`), origem "sprint" no kanban (fixa/automática), modal de detalhes da atividade, painel Início.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-09-28 | Notificações no macOS: assinatura ad-hoc do Electron (causa das notificações descartadas), verificação de permissão ao abrir com modal, estado nas Configurações, notificação de teste.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-28 | Criação deste PROJECT.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-28 | Permissão de notificação passa a usar o último resultado real persistido (o Electron ad-hoc não aparece em `ncprefs` no macOS 26).                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-28 | Novo evento **Saída de tarefa** (switch nas notificações): avisa quando uma tarefa sai da minha fila (reatribuída ou fechada), via foto da fila + journals.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-09-28 | **Agenda**: visões dia/semana/mês/lista, recorrência estilo Google, lembretes com notificação do sistema, camadas de sprints e prazos, busca, atalhos, painel "Agenda de hoje". Correção em `Input`/`Select`: largura explícita (`w-*`) agora substitui o `w-full` padrão.                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-28 | **Refatoração de arquitetura**: Clean Architecture + Ports & Adapters + DDD (domain/application/infrastructure/main/contracts), contrato IPC tipado no lugar do canal genérico `redmine.call`, i18n (pt-BR/en-US) com notificações e erros estruturados, atomic design na interface, ESLint com fronteiras de camada, Prettier e 67 testes (Vitest). TypeScript fixado em 5.9.3. Idioma configurável (padrão pt-BR).                                                                                                                                                                                           |
| 2026-09-28 | Código 100% em inglês (comentários, identificadores, testes, logs); `infra` → `infra`; i18n movido para `src/shared/i18n`; app id `com.eduardoschork.refinedredmine`; chave da foto da fila passa a `__my_queue__` (a primeira verificação após a atualização só tira uma foto nova).                                                                                                                                                                                                                                                                                                                          |
| 2026-09-28 | Passada de legibilidade no projeto inteiro: nomes autoexplicativos, sem ternário aninhado nem cadeias de if/else, rotinas longas quebradas em funções/componentes pequenos, comentários só de regra de negócio. Prettier com 4 espaços/120 colunas. ESLint passa a exigir `id-length` (mín. 2, exceto `t`/`_`), `no-nested-ternary`, `no-else-return`, `no-lonely-if`, `no-sequences`, `max-depth` 3 e `complexity` 12. Guia em CLAUDE.md → "Estilo de código".                                                                                                                                                |
| 2026-09-28 | **Manual do usuário** (`docs/MANUAL.md` + capturas em `docs/images/`, também como Claude Doc). Redmine falso `scripts/demo-redmine.mjs` e variável `REFINED_REDMINE_USER_DATA` para um perfil isolado. Correção: o seletor de status do modal inclui o status atual quando o Redmine não o envia em `allowed_statuses` (antes exibia o primeiro status permitido).                                                                                                                                                                                                                                             |
| 2026-09-28 | **Monitores**: notificações passam a ser por monitor (minhas tarefas, consulta salva, filtro por URL, quadro), cada um com eventos e horário próprios; entrada/saída por foto de IDs, mudança de coluna nos quadros, fusão "via" entre monitores; migração automática das configurações antigas. **Filtro por URL** também como origem de quadro. **Notificações do quadro** no editor. Lista de consultas salvas sem cache (consulta recém-criada aparece; botão de recarregar). **Log** (tela + `logs/activity.log`) com tempo e tamanho das requisições. `docs/REGRAS-DE-NEGOCIO.md` reúne todas as regras. |
| 2026-09-28 | `docs/FUNCIONAMENTO.md`: processos, timers (monitor que se reagenda, lembretes a cada 20 s, atualização das telas), ciclo do monitor, requisições (timeout, tentativas, paginação), memória × disco, arquivos e segurança (credenciais, proteções, limitações). Pendências de segurança registradas.                                                                                                                                                                                                                                                                                                           |
| 2026-09-28 | **Aparência**: tema claro/escuro/do sistema (`nativeTheme`), paletas (Padrão, Papel, Grafite, Meia-noite, Preto), cor de destaque personalizável com texto de contraste automático, tamanho da interface, reduzir animações. Configurações divididas em abas. Botões e destaques passam a usar o token `on-accent`.                                                                                                                                                                                                                                                                                            |
| 2026-09-28 | Preparação da 0.1.0: chave que não descriptografa volta para a tela de conexão (e a chave descriptografada fica em memória); **Sobre** em Configurações → Geral (versão, sistema, pasta de dados); `CHANGELOG.md`; dados reais da empresa nos testes trocados por fictícios.                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-28 | Primeiro `npm run dist:mac`: `electron-builder` 26 renomeou `nsis.allowToChangeInstallationDir` para `allowToChangeInstallationDirectory` (a validação falhava até no build do Mac). Gera `.dmg` Intel e Apple Silicon com assinatura ad-hoc, sem conta Apple.                                                                                                                                                                                                                                                                                                                                                 |
| 2026-09-28 | Manuais atualizados: `docs/MANUAL.md` (instalação do `.dmg` com Gatekeeper/Keychain, notificações desligadas no app instalado, caminhos das abas de Configurações) e o manual online (Claude Doc) sincronizado com o projeto: filtro por URL, notificações do quadro, monitores, Log, abas de Configurações, Aparência, Sobre e novas perguntas frequentes.                                                                                                                                                                                                                                                    |
| 2026-09-29 | `npm run dist:win` no Mac gera o instalador NSIS do Windows (x64) sem ajustes; falta testar numa máquina Windows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-29 | MVP 0.1.0 em uso: o usuário usou o `.dmg` o dia inteiro sem problemas e o líder do time instalou o `.exe` no Windows e está usando, sem feedback negativo até agora. Bolinha de prioridade dos cards documentada no manual e nas regras.                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-29 | Grupo 1 de acabamentos: permissão de notificação só "Permitidas" com prova (registro do macOS ou confirmação do usuário após o teste; `resolvePermission`, `notifications.confirm`, confirmação por cópia do app dev/instalado); verificação ao acordar (`powerMonitor` → `checkAfterWake`, lembretes na hora); "Copiar informações de suporte" (`app.supportReport`); `docs/INSTALACAO.md`. 95 testes.                                                                                                                                                                                                        |
| 2026-09-29 | **Atualizações pelo GitHub Releases** do repositório privado, com o token clássico de cada usuário (quem tem acesso ao repositório recebe; os outros não): `UpdateService`, `GithubReleaseSource` (redirecionamento do download seguido à mão para não vazar o token), `DesktopInstaller`, token criptografado em `config.json`, seção Atualizações, aviso na barra lateral, **O que há de novo**. Nomes dos instaladores sem espaços (`refined-redmine-<v>-mac-<arch>.dmg`, `-windows-setup.exe`). `npm run release` + `docs/RELEASE.md`. Versão 0.2.0 (não publicada; publicação pelo usuário). 105 testes.  |
| 2026-09-29 | Usuário testou no perfil de demonstração: grupo 1 (confirmação de notificações, suporte), seção Atualizações e teste de um token real com acesso ao repositório — tudo funcionando. Falta a primeira publicação (0.2.0).                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-29 | Auditoria de segredos antes do push: nenhuma chave/token/senha no código, no histórico ou nos arquivos que o git envia. Correções: chave/token com caractere inválido recusados antes da rede e segredos removidos de mensagens de erro (`isWellFormedSecret`, `redactSecret`); atualizações só de Releases do dono do repositório (`TRUSTED_PUBLISHER`); builds com `--publish never` e sem `GITHUB_TOKEN`. 109 testes.                                                                                                                                                                                       |
| 2026-09-29 | Token fine-grained (`github_pat_…`) aceito e recomendado no app e nos docs (clássico como alternativa). Endurecimento: `electronFuses` no build e app instalado recusa `--remote-debugging-port`/`--inspect`. Falta conferir no primeiro build.                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-29 | **0.2.0 publicada** no GitHub Releases pelo usuário (`npm run dist:mac` + `dist:win`, `npm run release -- --draft --skip-build`, revisão e Publish). Lição: com `--skip-build`, os três instaladores precisam estar em `dist/`.                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-29 | **Busca rápida** (`⌘K`/`Ctrl+K`: #id, título em todos os status, quadros, telas e 8 recentes) e **edição de campos** no detalhe (prioridade, responsável, versão, início, previsão, % concluído; relê a tarefa após salvar e avisa campos ignorados pelo Redmine). Portas novas `listProjectMembers` e `listPriorities`; demo com membros, prioridades, filtro `f[]` e versão só leitura em "Em teste". Testado no perfil de demonstração.                                                                                                                                                                     |
| 2026-09-29 | Busca também no **Início** (campo abaixo da saudação, `HomeSearch`). A busca rápida foi dividida em peças reaproveitáveis: `useQuickSearch`, `SearchResultList` (molécula), `Kbd` (átomo) e `lib/shortcuts.ts`; paleta e campo do Início usam as mesmas. Testado no perfil de demonstração.                                                                                                                                                                                                                                                                                                                    |
| 2026-09-29 | Versão **0.3.0** preparada (busca rápida, busca no Início, edição de campos): `package.json`, `CHANGELOG.md`, commit e tag `v0.3.0`. Push e `npm run release` pelo usuário. É a primeira versão que deve chegar pelo ciclo automático a partir da 0.2.0.                                                                                                                                                                                                                                                                                                                                                       |
