# Regras de negócio

Registro de todas as regras que o app aplica. Cada regra aponta para onde está implementada e testada. **Regra nova ou alterada entra aqui na mesma tarefa** (ver `CLAUDE.md`).

## Convenções do Redmine da empresa

| Regra                                                                                                                                                                                                         | Onde                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Versão `X.Y` é sprint; `X.Y.Z` é correção na branch da qualidade (staging) da sprint `X.Y`; outros nomes são agrupadores. Os padrões são regex configuráveis.                                                 | `domain/sprint/sprint-classifier.ts`     |
| Só "Finalizada" é status fechado; "Resolvida" e "Em teste" continuam abertos.                                                                                                                                 | Redmine (lido de `/issue_statuses.json`) |
| Datas da sprint vêm de campos personalizados da versão, detectados pelo nome: `limite\|dev` = prazo dos devs; `publica\|lança\|release\|deploy` = publicação. Sem campo de publicação, vale a data da versão. | `detectDateFields`                       |

## Sprints

| Regra                                                                                                                           | Onde                                |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Em desenvolvimento**: sprint aberta com o prazo dos devs mais próximo que ainda não venceu (desempate pelo número da versão). | `classifySprints`                   |
| **Em homologação**: aberta, prazo dos devs vencido, publicação no futuro.                                                       | `classifySprints`                   |
| **Publicação atrasada**: aberta, com a data de publicação já passada.                                                           | `classifySprints`                   |
| **Planejada**: demais sprints abertas.                                                                                          | `classifySprints`                   |
| **Em produção**: a última sprint fechada já publicada.                                                                          | `classifySprints`                   |
| **Correção**: versão `X.Y.Z` aberta; a sprint de origem é `X.Y`.                                                                | `classifySprints`                   |
| Quadro de sprint automática segue a fase escolhida (desenvolvimento, homologação ou correção) e troca sozinho de versão.        | `pickSprint`, `BoardFilterResolver` |
| Versões ordenadas numericamente: 3.9 < 3.10 < 3.10.1.                                                                           | `compareVersions`                   |

## Início (fila de trabalho)

| Regra                                                                                                                                         | Onde                      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Parada**: sem atualização há N dias (padrão 5, configurável) **ou** com status que contém pausa/bloque/aguard/impedi (ou pause/block/wait). | `domain/redmine/queue.ts` |
| **Atrasada**: data prevista no passado e tarefa não fechada.                                                                                  | `isOverdue`               |
| **Prazos**: vencidas ou vencendo nos próximos 7 dias.                                                                                         | `analyzeQueue`            |

## Quadros (kanban)

| Regra                                                                                                                                                                                                  | Onde                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Cada coluna agrupa um ou mais status; um status fica em uma só coluna.                                                                                                                                 | `BoardEditor`, `columnOf`   |
| Soltar um card numa coluna muda o status para o **primeiro status da coluna que o fluxo do Redmine permite** para a tarefa; se nenhum for permitido, a coluna fica esmaecida e o movimento é recusado. | `canDropOn`, `targetStatus` |
| A coluna atual sempre aceita o card; enquanto os status permitidos carregam, nada é bloqueado.                                                                                                         | `canDropOn`                 |
| "Uma por status" cria uma coluna por status aberto e uma coluna "Fechadas" com todos os fechados.                                                                                                      | `columnsFromStatuses`       |
| Origem **consulta salva** ou **filtro (URL)**: valem os filtros do Redmine; as colunas só organizam por status.                                                                                        | `boardIssueFilter`          |
| Até 500 tarefas por quadro.                                                                                                                                                                            | `MAX_BOARD_ISSUES`          |
| Quadro precisa de nome, origem válida e ao menos uma coluna com status.                                                                                                                                | `assertValidBoard`          |
| Excluir um quadro exclui também o monitor dele.                                                                                                                                                        | `DeleteBoardUseCase`        |

## Filtro por URL

| Regra                                                                                                                                                                                            | Onde                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Aceita o endereço de qualquer lista de tarefas do Redmine (`…/issues?…` ou `…/projects/<id>/issues?…`), com ou sem o host; os parâmetros são repassados para `/issues.json`.                     | `parseIssuesUrl`     |
| Paginação e exibição são descartadas (`page`, `per_page`, `offset`, `limit`, `format`, `utf8`, `commit`); o parâmetro `key` **nunca** é repassado, para não vazar uma API key colada por engano. | `IGNORED_PARAMETERS` |
| `/projects/<id>/issues` vira `project_id=<id>`, se a URL ainda não tiver um.                                                                                                                     | `parseIssuesUrl`     |

## Monitores e notificações

| Regra                                                                                                                                                                                                                                            | Onde                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Um **monitor** acompanha um conjunto de tarefas (minhas tarefas, consulta salva, filtro por URL ou quadro) e tem as próprias opções de aviso. "Minhas tarefas" sempre existe, vem primeiro e não pode ser excluído.                              | `domain/monitor/monitor.ts`                    |
| **Alterações feitas pelo próprio usuário não notificam**, em nenhum monitor: journals do usuário são ignorados, e entradas/saídas cuja última mudança foi dele também.                                                                           | `MonitorCycle.journalsToNotify`, `changedByMe` |
| Primeira execução só grava a marca d'água e as fotos: nada anterior é notificado.                                                                                                                                                                | `MonitorService.newCycle`                      |
| Marca d'água = maior `updated_on` visto por qualquer monitor (relógio do servidor).                                                                                                                                                              | `MonitorCycle.sawUpdate`                       |
| Um journal vira uma notificação com o tipo mais importante **que estiver ligado no monitor**: menção > atribuída a mim > status > comentário > outras alterações.                                                                                | `interpretJournal`, `notifyJournals`           |
| A mesma alteração vista por dois monitores gera **uma** notificação, que lista os dois ("via …").                                                                                                                                                | `MonitorCycle.add`                             |
| Eventos por origem: minhas tarefas = nova tarefa, atribuída, status, comentário, menção, outras, saiu da fila; consulta/filtro/quadro = entrou, saiu, atribuída, status, comentário, menção, outras. "Outras alterações" vem desligado.          | `availableEvents`, `defaultEvents`             |
| **Nova tarefa** (minhas tarefas): criada depois da marca d'água por outra pessoa.                                                                                                                                                                | `mine-check.ts`                                |
| **Saiu da fila** (minhas tarefas): estava aberta e atribuída a mim e deixou de estar. O journal mais recente que tirou de mim ou fechou explica a saída e não gera outro aviso. Tarefa que ficou invisível gera aviso próprio. Até 15 por ciclo. | `explainQueueExit`, `mine-check.ts`            |
| **Entrou/saiu** (consulta, filtro, quadro): compara os IDs com a foto do ciclo anterior. Com mais de 500 resultados a comparação por ID não é confiável, então só a contagem é comparada e avisada.                                              | `diffMembership`, `MAX_MONITOR_ISSUES`         |
| Quadro: mudança de status que troca o card de coluna aparece como "moveu de <coluna> para <coluna>". Sair do quadro inclui ir para um status que nenhuma coluna mostra.                                                                          | `columnChange`, `withColumnChange`             |
| Desligar (ou excluir) um monitor apaga a foto dele; ao religar, começa de novo sem enxurrada. O mesmo vale para "saiu da fila".                                                                                                                  | `pruneSnapshots`                               |
| Horário geral: fora da janela o monitor inteiro pausa e a marca d'água não avança, então o período chega agrupado. Horário próprio de um monitor se soma ao geral.                                                                               | `isWithinSchedule`, `MonitorService.isDue`     |
| Um monitor com erro não impede os outros; o erro aparece na tela de Notificações e no Log.                                                                                                                                                       | `checkMonitor`                                 |
| No máximo 40 históricos de tarefa lidos por ciclo (somando todos os monitores); o que passar fica para o próximo.                                                                                                                                | `MAX_JOURNAL_READS_PER_CYCLE`                  |
| Mais de 4 notificações num ciclo viram uma notificação resumida do sistema.                                                                                                                                                                      | `SUMMARY_THRESHOLD`                            |
| Histórico guarda as últimas 300 notificações.                                                                                                                                                                                                    | `MAX_NOTIFICATIONS`                            |
| Intervalo mínimo de verificação: 30 s (padrão 60 s).                                                                                                                                                                                             | `MIN_POLL_SECONDS`                             |
| Lembretes da agenda sempre mostram a notificação do sistema; guardar no histórico é opcional.                                                                                                                                                    | `ReminderDispatcher`                           |
| Configurações antigas (escopos, switches por tipo, consultas personalizadas) viram monitores automaticamente: "aumentar" → avisa entradas, "diminuir" → avisa saídas, "qualquer" → ambos.                                                        | `withDefaults`                                 |

## Agenda

| Regra                                                                                                                                                                                   | Onde                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Horários são locais "flutuantes" (sem fuso).                                                                                                                                            | `domain/calendar`                   |
| Repetição mensal no dia 31 e anual em 29/02 pulam os meses/anos sem esse dia, como no Google.                                                                                           | `recurrence.ts`                     |
| Editar/excluir recorrente: **este evento** (exceção por data), **este e os seguintes** (divide a série, inclusive com contagem) ou **todos** (desloca a série pela diferença de datas). | `planSave`, `planDelete`            |
| Lembretes de dia inteiro contam a partir de um horário padrão (9h, configurável).                                                                                                       | `reminderBase`                      |
| Lembrete atrasado em até 10 min ainda dispara; cada lembrete dispara uma vez; as marcas de disparo são limpas após 3 dias.                                                              | `REMINDER_GRACE_MS`, `FIRED_TTL_MS` |

## Aparência

| Regra                                                                                                                                    | Onde                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Tema "Do sistema" segue o claro/escuro do sistema operacional; Claro/Escuro forçam o tema também nos menus nativos e na barra de título. | `ElectronNativeTheme`           |
| Cada tema tem a sua paleta (claro: Padrão/Papel; escuro: Grafite/Meia-noite/Preto).                                                      | `appearance.ts`, `styles.css`   |
| No tema escuro, a cor de destaque é clareada (78% da cor + 22% de branco) para manter o contraste.                                       | `darkThemeAccent`, `styles.css` |
| O texto sobre a cor de destaque é preto ou branco, o que tiver mais contraste (luminância WCAG).                                         | `textOnAccent`                  |
| Valores inválidos no arquivo (tema, paleta, cor que não é `#rrggbb`, tamanho fora de 90/100/110/125) voltam ao padrão.                   | `withAppearanceDefaults`        |

## Log

| Regra                                                                                                                                                                        | Onde                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Cada requisição ao Redmine é registrada com método, caminho + parâmetros, status, tempo, tamanho da resposta e tentativa; a API key vai no cabeçalho e nunca aparece no log. | `RedmineHttpClient`, `ActivityLogFile` |
| O arquivo (`logs/activity.log`) vai até 5 MB; ao passar, os 40% mais antigos são descartados. Falha ao gravar o log nunca afeta o app.                                       | `ActivityLogFile`                      |

## Conta e segurança

| Regra                                                                                                                       | Onde                               |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| A URL precisa ter `http://` ou `https://`; a chave é validada em `/my/account.json`.                                        | `LoginUseCase`                     |
| A API key fica só no processo principal, criptografada pelo sistema (Keychain/DPAPI).                                       | `SafeStorageSecretStore`           |
| Chave que não pode ser descriptografada conta como ausente: o app pede para conectar de novo.                               | `SafeStorageSecretStore.hasApiKey` |
| Desconectar apaga a chave, a marca d'água, as fotos do monitor e o histórico de notificações; quadros e preferências ficam. | `LogoutUseCase`                    |
| Links externos só abrem se forem `http(s)`.                                                                                 | `main/window.ts`                   |
