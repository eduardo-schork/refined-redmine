# Como o app funciona por dentro

Referência técnica: processos, timers, requisições, o que fica em memória e o que vai para o disco, e segurança. As regras de negócio estão em [`REGRAS-DE-NEGOCIO.md`](REGRAS-DE-NEGOCIO.md) e a arquitetura em camadas em [`../PROJECT.md`](../PROJECT.md) §4. **Atualize este arquivo quando mudar algo descrito aqui.**

## 1. Processos

| Processo                                 | O que faz                                                                              | Acessa a rede?    | Acessa arquivos? |
| ---------------------------------------- | -------------------------------------------------------------------------------------- | ----------------- | ---------------- |
| **Principal** (Node, `src/main`)         | Monitor, lembretes, requisições ao Redmine, arquivos, notificações do sistema, bandeja | Sim (`net.fetch`) | Sim              |
| **Interface** (Chromium, `src/renderer`) | Telas                                                                                  | Não               | Não              |
| **Preload** (`src/preload`)              | Expõe `window.bridge`, gerado a partir de `API_METHODS`                                | Não               | Não              |

A interface só conversa com o processo principal pelo contrato IPC (`contracts/api.ts`). O processo principal continua vivo na bandeja quando a janela é fechada. **Não há serviço, cron nem job no sistema operacional**: com o app encerrado (Sair), nada roda. "Abrir ao iniciar o computador" só registra o app como item de login.

## 2. Timers

Todos passam pela porta `Scheduler` (`infra/system/system.ts`: `setTimeout`/`setInterval`). Nos testes ela é trocada por um agendador que não faz nada, e os ciclos são chamados direto.

| Quem                | Tipo                                                    | Frequência                                                                                                                               | Onde                       |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Monitor             | `setTimeout` que se reagenda **depois** do fim do ciclo | `pollSeconds` (padrão 60 s, mínimo 30 s); o primeiro ciclo roda 1 s após iniciar                                                         | `MonitorService.schedule`  |
| Lembretes           | `setInterval`                                           | 20 s (`REMINDER_TICK_MS`); também roda um ciclo ao iniciar                                                                               | `ReminderDispatcher.start` |
| Quadro aberto       | `refetchInterval` (TanStack Query)                      | 60 s                                                                                                                                     | `hooks/boards.ts`          |
| Minha fila (Início) | `refetchInterval`                                       | 120 s                                                                                                                                    | `hooks/issues.ts`          |
| Tela Log            | `refetchInterval`                                       | 5 s (lê o arquivo, sem Redmine)                                                                                                          | `hooks/activity-log.ts`    |
| Atualizações        | `setTimeout` + `setInterval`                            | 30 s após iniciar; depois `updates.intervalHours` (1, 4, 12, 24 ou 168 h; padrão 24 h). Mudar o intervalo ou o switch reinicia os timers | `UpdateService.start`      |

- **Monitor sem sobreposição**: o próximo ciclo só é agendado no `finally` do atual, e a flag `running` impede dois ciclos ao mesmo tempo ("Verificar agora" durante um ciclo é ignorado).
- **"Verificar agora"** (`runNow`): cancela o timer pendente, roda um ciclo na hora (ignorando o horário configurado) e reagenda.
- **Mudança em monitores, intervalo ou horário** (`affectsMonitor`), ou ligar as notificações de um quadro: `monitor.start()` cancela e recomeça em 1 s.
- **Fora do horário**: o ciclo acorda, não faz requisição, marca `paused: 'schedule'` e se reagenda.
- Os `refetchInterval` só rodam com a tela aberta; com a janela fechada sobram só o monitor e os lembretes.

### Computador em repouso

- Os timers congelam durante o sono. Ao acordar, o `powerMonitor` (evento `resume`, em `main/index.ts`) antecipa a próxima verificação do monitor para 10 s depois (`MonitorService.checkAfterWake`; a rede costuma demorar a voltar) e roda os lembretes na hora (`ReminderDispatcher.tick`).
- **Monitor**: nada se perde; o primeiro ciclo traz tudo desde a marca d'água, agrupado.
- **Lembretes**: um lembrete atrasado em até 10 min ainda dispara; os mais antigos são pulados.

## 3. Um ciclo do monitor

```
ciclo (MonitorService.runChecks)
 ├─ apaga as fotos de monitores desligados/excluídos (pruneSnapshots)
 ├─ status do Redmine: 1ª vez via /issue_statuses.json, depois em memória
 ├─ para cada monitor ligado e dentro do horário próprio, em ordem (um de cada vez):
 │   ├─ Minhas tarefas (mine-check.ts)
 │   │   ├─ GET /issues.json?assigned_to_id=me&status_id=open        (fila, até 500)  → saídas
 │   │   ├─ GET /issues.json?{assigned_to_id|watcher_id|author_id}=me&status_id=*&updated_on=>=<marca>&sort=updated_on:desc
 │   │   └─ GET /issues/:id.json?include=journals                      (só tarefas que mudaram)
 │   └─ Consulta / filtro / quadro (source-check.ts)
 │       ├─ GET /issues.json?query_id=… | <parâmetros da URL> | <filtro do quadro>   (até 500) → entrou/saiu
 │       └─ GET /issues/:id.json?include=journals  (só as com updated_on > marca; reaproveita o que já foi lido)
 ├─ grava a marca d'água = maior updated_on visto
 ├─ notificações: state.json + notificação do sistema + evento para a janela
 └─ log: "Verificação concluída: N monitores, X notificações em Y ms"
```

- As requisições são **sequenciais** (um `await` por vez), para não sobrecarregar o Redmine.
- Com nada mudando, um ciclo faz poucas requisições: fila + 3 escopos + 1 por monitor extra (mais páginas se passar de 100).
- Históricos lidos: no máximo **40 por ciclo** somando todos os monitores (`MAX_JOURNAL_READS_PER_CYCLE`); saídas da fila têm limite próprio de 15. `MonitorCycle` guarda cada histórico lido em memória durante o ciclo e funde notificações repetidas.
- Um monitor com erro não interrompe os outros (erro no status da tela Notificações e no Log).
- Com `query_id` o Redmine ignora outros filtros, por isso a comparação "mudou depois da marca" é feita no app, sobre o resultado.

## 4. Requisições HTTP

`infra/redmine/http-client.ts` (`RedmineHttpClient`) + `http-redmine-gateway.ts`:

| Item             | Valor                                                                                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transporte       | `net.fetch` do Electron (pilha de rede do Chromium: proxy e certificados do sistema)                                                                                                                                                                           |
| Autenticação     | cabeçalho `X-Redmine-API-Key` (nunca na URL)                                                                                                                                                                                                                   |
| Timeout          | 30 s por tentativa                                                                                                                                                                                                                                             |
| Novas tentativas | só `GET`: até 3 tentativas, espera de 400 ms e depois 800 ms, em erro de rede ou 5xx; 4xx não repete. `PUT` (mudar status, comentar) tenta uma vez só. O login (`GET /my/account.json`) também tenta uma vez só (`noRetry`): no máximo 30 s até o erro na tela |
| Paginação        | 100 por página; para no máximo pedido, no `total_count` ou numa página incompleta. Tarefas: até 500 (quadros e monitores); projetos e consultas: até 1000                                                                                                      |
| Erros            | viram `AppError` com código (`network.dns`, `redmine.unauthorized`…) e são traduzidos na interface                                                                                                                                                             |
| Log              | cada tentativa gera um registro (observador passado ao cliente em `main/container.ts`)                                                                                                                                                                         |

Requisições da busca e da edição:

| Ação              | Requisição                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buscar por número | `GET /issues/:id.json` (404/403 = sem resultado)                                                                                                                                                                                        |
| Buscar por texto  | `GET /issues.json?set_filter=1&f[]=status_id&op[status_id]=*&f[]=subject&op[subject]=~&v[subject][]=<texto>&sort=updated_on:desc&limit=20`. Com `f[]`, o Redmine ignora os parâmetros simples, por isso o status também vai como filtro |
| Opções de edição  | `GET /projects/:id/memberships.json` (paginado) e `GET /projects/:id/versions.json`                                                                                                                                                     |
| Prioridades       | `GET /enumerations/issue_priorities.json`                                                                                                                                                                                               |
| Salvar campo      | `PUT /issues/:id.json` com só o campo mudado (texto vazio limpa) e depois `GET /issues/:id.json` para conferir o que o Redmine aplicou                                                                                                  |

A interface pede dados sempre pelo IPC; o processo principal faz a requisição. Não existe acesso direto da interface ao Redmine (a CSP bloqueia).

## 5. Memória × disco

**O conteúdo das respostas do Redmine nunca é gravado em arquivo.**

| Onde                                  | O que                                                                                                                 | Quanto tempo                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Memória da interface (TanStack Query) | Tarefas, quadros, sprints, detalhes                                                                                   | Enquanto a janela existir. Reuso sem nova busca: sessão e agenda até mudarem; status, projetos e prioridades 1 dia; consultas salvas, sprints e opções de edição (membros e versões) 5 min; busca 30 s; estatísticas da sprint 2 min; status permitidos de uma tarefa 1 min; o resto (detalhe da tarefa, tarefas da versão) é buscado de novo ao abrir |
| Memória do processo principal         | Status, projetos e prioridades (`ReferenceDataQueries`); mapa de status do monitor; históricos lidos durante um ciclo | Até reiniciar o app (os do ciclo, só durante o ciclo)                                                                                                                                                                                                                                                                                                  |
| Memória do processo principal         | Cópia de cada arquivo JSON (`JsonFile`)                                                                               | Carregada na 1ª leitura; toda escrita atualiza a cópia e o disco                                                                                                                                                                                                                                                                                       |
| Disco                                 | Arquivos da §6                                                                                                        | Permanente                                                                                                                                                                                                                                                                                                                                             |

O resumo do quadro, os contadores de atenção, as cores de status e o painel da sprint **não fazem requisições novas**: são calculados na interface a partir das tarefas que o quadro já carregou, da lista de status (cache de 1 dia) e da sprint resolvida pelo processo principal (que também estima o início da sprint, `devStart`).

As consultas salvas **não** ficam em cache no processo principal, para uma consulta recém-criada no Redmine aparecer sem reiniciar.

## 6. Arquivos

Pasta: macOS `~/Library/Application Support/Refined Redmine/` · Windows `%APPDATA%\Refined Redmine\` (em dev dá para trocar com a variável `REFINED_REDMINE_USER_DATA`).

| Arquivo             | Conteúdo                                                                                                                                                                                | Formato / escrita                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.json`       | URL, usuário, idioma, quadros, monitores, sprints, agenda, preferências (inclui `issueStyle`: cores de status, níveis de prioridade, dias de "vence em breve"), `apiKeyEnc`             | JSON; escrita atômica (`.tmp` + rename) a cada mudança                                                                                                  |
| `state.json`        | `lastCheckAt` (marca d'água), `querySnapshots` (fotos: contagem, IDs e títulos por monitor + `__my_queue__`), `events` (notificações, máx. 300), `notify` (último resultado de entrega) | JSON; escrita atômica quando algo muda no ciclo                                                                                                         |
| `calendar.json`     | `events` (compromissos; uma série = um registro com a regra e as exceções), `fired` (lembretes disparados, limpos após 3 dias)                                                          | JSON; escrita atômica                                                                                                                                   |
| `logs/activity.log` | Requisições (método, caminho + parâmetros, status, tempo, bytes, tentativa, código de erro) e passos do monitor                                                                         | JSON Lines, um objeto por linha acrescentado ao fim; a tela lê as últimas 2000 linhas; acima de 5 MB descarta os 40% mais antigos; "Apagar log" esvazia |

- JSON corrompido é renomeado para `<arquivo>.corrupted-<timestamp>` e o app recomeça com os padrões.
- Campos antigos do `config.json` (`scopes`, `eventKinds`, `customQueries`) são convertidos em monitores ao ler e somem no próximo salvamento.
- As pastas `Cache`, `GPUCache`… são do Chromium; o app não guarda dados nelas. Exceção: `Local Storage` guarda a lista de tarefas recentes da busca rápida (`refined-redmine.recent-issues`: número, título e projeto das 8 últimas tarefas abertas). Se o armazenamento falhar, a lista só fica vazia.

### Agenda

- Compromissos só em `calendar.json`; nada vai para o Redmine.
- Horário local "flutuante" (sem fuso). As ocorrências de uma série são calculadas na hora (`domain/calendar/recurrence.ts`), para a tela e para os lembretes.
- `ReminderDispatcher` (a cada 20 s): calcula as ocorrências em volta de agora, dispara os lembretes vencidos (até 10 min de atraso), marca em `fired` e, se "Guardar lembretes no histórico" estiver ligado, grava a notificação em `state.json`.

## 7. Permissão de notificações

- `DesktopNotificationPermission` junta as evidências e `resolvePermission` (domínio) decide: sistema recusou a entrega → bloqueada; macOS sem assinatura → bloqueada; registro do macOS (`com.apple.ncprefs`, bit 4 = alertas) quando existe; senão, a resposta do usuário ao teste (`notifications.confirm(seen)`, gravada em `state.json` → `notifyConfirmation`). Sem nada disso: `unconfirmed`, e a janela de confirmação abre ao iniciar.
- O "show" do Electron não é prova: ele acontece mesmo quando o sistema descarta a notificação.
- Confirmação e resultado de entrega levam `app: 'dev' | 'installed'` (`app.isPackaged`); registros da outra cópia são ignorados.

## 8. Atualizações

- **Fonte**: GitHub Releases de `eduardo-schork/refined-redmine` (privado), lidas com o token de cada usuário (`GithubReleaseSource`, `net.fetch`).
  - `GET api.github.com/repos/…/releases/latest`; um 404 é conferido em `GET /repos/…` para separar "sem versão publicada" de "sem acesso".
  - Download: `GET` no endereço de API do arquivo com `Accept: application/octet-stream` → redirecionamento para um endereço assinado de armazenamento. O redirecionamento é seguido à mão (`net.request`, `redirect: 'manual'`) para o token não ir junto (o armazenamento recusa duas credenciais). O arquivo é gravado como `<nome>.part` na pasta Downloads e renomeado ao terminar; tamanho diferente do esperado descarta o arquivo.
  - Requisições ao GitHub aparecem no Log; do endereço assinado só o caminho é registrado (a query tem credenciais temporárias).
- **Estado** (`UpdateService`, só em memória): `disabled` (sem token) → `checking` → `upToDate` | `available` → `downloading` → `ready`; `error` com o código. Mudanças vão para a janela pelo evento `update.status`.
- **Token**: `config.json` → `githubTokenEnc`, criptografado com `safeStorage` (sem criptografia disponível, não é salvo). Fica no processo principal; a interface só envia um token digitado para `testToken`/`setToken`.
- **Instalar** (`DesktopInstaller`): Windows roda o instalador NSIS com `/S --updated --force-run` e fecha o app; macOS abre o `.dmg` e fecha o app em 1,5 s.
- **O que há de novo**: o `CHANGELOG.md` é embutido na interface no build (`?raw`); `settings.lastSeenVersion` guarda a última versão mostrada.
- **Publicação**: automática pelo GitHub Actions (`.github/workflows/release.yml`) a cada push no `master` com `feat:`/`fix:`; o job `publish` usa o secret `RELEASE_TOKEN` do environment `release` (só no `master`), e os jobs de build não recebem token. Plano B: `npm run release` (`scripts/release.mjs`) com `GITHUB_TOKEN`. Ver [RELEASE.md](RELEASE.md).

## 9. Suporte

- `app.supportReport()` (`BuildSupportReportUseCase`) monta os dados; a interface formata em texto no idioma atual (`renderer/src/lib/support-report.ts`) e copia para a área de transferência. Nunca inclui a chave de API.

## 10. Tema e aparência

- Preferências em `config.json` → `appearance` (tema, paleta clara, paleta escura, cor de destaque, tamanho, reduzir animações).
- **Tema**: o processo principal aplica `nativeTheme.themeSource` (`system` | `light` | `dark`) ao iniciar e quando o tema muda (`UpdateSettingsUseCase` → `ElectronNativeTheme`). Isso muda o `prefers-color-scheme` da página, os menus nativos, a barra de título e as barras de rolagem; o CSS continua usando só `@media (prefers-color-scheme)`. A cor de fundo da janela antes de carregar (`windowBackground`) segue o mesmo tema, para não piscar.
- **Paletas, destaque, tamanho e animações**: `useApplyAppearance` (`renderer/src/lib/appearance.ts`) grava no `<html>` os atributos `data-light-palette`, `data-dark-palette` e `data-reduce-motion`, as variáveis `--accent-base`, `--accent-text-light` e `--accent-text-dark`, e o `zoom` da página. Os tokens de cor (`--bg`, `--panel`, `--accent`, `--accent-soft`, `--on-accent`…) são derivados em `styles.css` (com `color-mix`).
- Os componentes usam só tokens (`bg-accent`, `text-on-accent`, `bg-panel`…); cores fixas ficam só onde fazem sentido (cores dos compromissos, fases das sprints, linha da hora atual).

## 11. Segurança

### Credenciais

1. A tela de conexão manda URL e chave pelo IPC (`session.login`).
2. O processo principal valida em `/my/account.json` e grava a chave com `safeStorage.encryptString` → `config.json.apiKeyEnc` (base64). A chave de criptografia fica com o sistema: **Keychain** no macOS, **DPAPI** no Windows.
3. A cada requisição, `SafeStorageSecretStore.getApiKey()` entrega a chave (descriptografada na primeira vez e mantida na memória do processo principal enquanto o valor gravado não mudar) e o cliente manda no cabeçalho. A chave não vai para a URL nem para o log.
4. Chave que não pode ser descriptografada (outro computador, outra assinatura do app, Keychain redefinido) conta como ausente: o app volta para a tela de conexão.
5. A interface nunca recebe a chave (`SettingsView` só tem `hasApiKey`).
6. Sem criptografia disponível no sistema, a chave fica em `apiKeyPlain` (não acontece em macOS/Windows).
7. Desconectar apaga a chave, a marca d'água, as fotos e o histórico de notificações.

### Proteções

- Janela com `sandbox: true` e `contextIsolation: true`; `window.bridge` só expõe os métodos do contrato.
- CSP: `default-src 'self'`, sem scripts nem conexões externas.
- Links externos abrem no navegador só se forem `http(s)`.
- Token do GitHub: criptografado como a chave do Redmine, nunca no log nem no relatório de suporte; o instalador baixado só é aberto se o tamanho bater com o informado pelo GitHub.
- Chave do Redmine e token do GitHub só com letras, números e `_` (`isWellFormedSecret`): um valor com espaço ou quebra de linha colado por engano é recusado antes de ir para a rede, porque o erro de cabeçalho inválido traria o próprio valor na mensagem. Mensagens de erro de rede passam por `redactSecret`.
- Atualizações só aceitam Releases e instaladores publicados pela conta dona do repositório (`TRUSTED_PUBLISHER`): colaboradores de repositório pessoal têm escrita e poderiam publicar um instalador que os apps executariam.
- **Fuses do Electron** (`electronFuses` no `electron-builder.yml`, gravados no executável): sem "rodar como Node" (`ELECTRON_RUN_AS_NODE`), sem `NODE_OPTIONS` e sem `--inspect`, com validação de integridade do `app.asar` e carregando o app só dele. Assim outro programa não roda código com a identidade do app, que tem acesso ao Keychain/DPAPI onde ficam a chave e o token.
- O app **instalado** não abre se iniciado com depuração remota (`--remote-debugging-port`, `--remote-debugging-pipe`, `--inspect`), que os fuses não cobrem (`main/index.ts`). O app de dev continua aceitando, para os testes pelo DevTools no perfil de demonstração.
- Os builds rodam com `--publish never` e o `npm run release` não repassa o `GITHUB_TOKEN` para eles: só o próprio script publica.
- O filtro por URL descarta o parâmetro `key`.
- Código e histórico do git sem chaves, senhas ou tokens (verificado em 2026-09-28). O `apiKeyPlain: 'demo'` do `scripts/demo-redmine.mjs` é fictício.

### Limitações conhecidas

- `state.json`, `calendar.json` e o log **não são criptografados**: têm títulos de tarefas, trechos de comentários, nomes e compromissos. Qualquer processo com acesso à conta do usuário consegue ler.
- Em dev (assinatura ad-hoc), o item do Keychain fica associado ao "Electron" genérico; no app instalado, à assinatura do app.
- Com um Redmine em `http://`, a chave trafega sem TLS (o da empresa é `https`).
- Os handlers IPC não verificam a origem da chamada (só a janela do app carrega o preload) nem o formato dos argumentos em tempo de execução.
- A CSP é a mesma em dev e produção e libera `ws:` para qualquer endereço (usado só pelo recarregamento do dev).
- O `activity.log` guarda os parâmetros das requisições, inclusive o texto digitado na busca rápida.
- A atualização confere publicador e tamanho do instalador, mas não o hash.

O plano para cada item, com prioridade, está no roadmap: `PROJECT.md` §8, "Segurança".
