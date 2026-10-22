# Refined Redmine

App desktop (macOS e Windows) sobre o Redmine: kanban de verdade e notificações nativas do sistema.
Sem backend — cada pessoa informa a URL do Redmine e a própria API key, e o app conversa direto com a API REST.

## Rodando

```bash
nvm use            # Node 20.19+ (ver .nvmrc)
npm install
npm run dev
```

No primeiro acesso, informe a URL do Redmine e a chave em **Minha conta → Chave de acesso à API**. Para instalar a partir do `.dmg`/`.exe`: [docs/INSTALACAO.md](docs/INSTALACAO.md).

Como usar cada tela: [manual do usuário](docs/MANUAL.md).

| Comando             | O que faz                                                                |
| ------------------- | ------------------------------------------------------------------------ |
| `npm run dev`       | App em modo desenvolvimento (hot reload na interface)                    |
| `npm run typecheck` | Checagem de tipos                                                        |
| `npm run dist:mac`  | Gera `.dmg` em `dist/`                                                   |
| `npm run dist:win`  | Gera instalador `.exe` (NSIS) em `dist/`                                 |
| `npm run icons`     | Regera os ícones em `build/` e `resources/`                              |
| `npm run release`   | Publica a versão no GitHub Releases ([docs/RELEASE.md](docs/RELEASE.md)) |

## Funcionalidades

**Início (dashboard)**

- Indicadores: minha fila, paradas (sem movimentação há N dias ou em pausa/aguardando), atrasadas, notificações não lidas.
- Sprints ativas com prazo dos devs, publicação e progresso; listas da minha fila, paradas e prazos.

**Agenda**

- Visões dia, semana, mês e lista; criar clicando ou arrastando na grade; cores, local, descrição e vínculo com tarefa do Redmine.
- Repetição como no Google Agenda (dias úteis, semanal em vários dias, mensal no dia N ou na Nª segunda, anual, personalizada com fim por data ou contagem) e edição "este / este e os seguintes / todos".
- Lembretes (5 min, 1 dia antes…) com notificação do sistema, mesmo com a janela fechada.
- Camadas do Redmine: prazos e publicações das sprints, prazos das minhas tarefas.
- Compromissos salvos em `calendar.json` na pasta de dados do app.

**Sprints**

- As versões de um projeto viram sprints. Convenção: `X.Y` = sprint (ex.: 3.78); `X.Y.Z` = correção na branch da qualidade/staging (ex.: 3.77.1); o resto são agrupadores (backlog…).
- Datas lidas dos campos personalizados da versão (detectados pelo nome: "Prazo dos devs", "Publicação").
- Fase calculada: em desenvolvimento (prazo dos devs mais próximo), em homologação (prazo vencido, publicação futura), publicação atrasada, planejada, em produção (última publicada), correção.
- Lista de tarefas por status e "Criar quadro desta versão".

**Detalhes da atividade**

- Clique em qualquer tarefa (kanban, início, sprints) abre um modal com descrição (Markdown), campos, abas de tarefas relacionadas (subtarefas e relações com título, status e responsável), anexos (imagens, texto, vídeo e áudio vistos no próprio app, documentos no app do sistema; imagens citadas na descrição e nos comentários aparecem como miniatura) e horas, e histórico; permite mudar status, comentar e editar título, descrição, tipo, prioridade, responsável, versão, datas, % concluído, estimativa e tarefa pai. Descrição longa aparece cortada em 25 linhas, com "Mostrar tudo".
- **Abas**: cada tela e cada quadro abrem numa aba (Ctrl+Tab, ⌘1…9), que guarda o estado e volta ao reabrir o app; configurável em Configurações → Geral → Abas.
- **Trâmites** configuráveis (Configurações → Automações) no detalhe da tarefa: comentar e mover a própria tarefa ou enviar para a tarefa vizinha (ex.: Qualidade) citando notas, com horas e fechamento; **Alterar em massa** situação, responsável e versão de uma árvore de tarefas.
- **Horas extras** (banco no app, meses no banco ou pagos) e **Tempo do time** (horas por pessoa e dia, médias, detalhe por tarefa ou atividade).
- **Criar tarefa** pela barra lateral, por `⌘N`/`Ctrl+N` ou pelo quadro (já no projeto e na sprint do quadro), e **Nova subtarefa** no detalhe: projeto, tipo, título, descrição, campos personalizados do tipo (com sugestões; a subtarefa herda da pai), anexos (escolher, arrastar ou colar, com miniaturas), prioridade, responsável, versão, tarefa pai, datas e estimativa.
- **Busca rápida** (`⌘K` / `Ctrl+K`): tarefa por `#número` ou título, quadros, telas e tarefas recentes. Links `#1234` abrem no próprio modal. Botão "Abrir no Redmine".

**Kanban**

- Quadro a partir de: tarefas atribuídas a mim, um projeto (com/sem subprojetos), uma consulta salva, um **filtro copiado da tela do Redmine (URL)** ou uma sprint — fixa ou automática ("sprint em desenvolvimento", "em homologação", "correção aberta"), que troca sozinha quando a sprint muda de fase.
- Colunas configuráveis; cada coluna agrupa um ou mais status.
- Arrastar um card muda o status no Redmine. Ao começar a arrastar, o app consulta `allowed_statuses` da tarefa e esmaece as colunas que o fluxo de trabalho não permite.
- Raias por responsável, atualização automática a cada 60 s.
- **Filtros rápidos** para quadro e lista: busca, responsável, tipo, situação e versão (várias opções de cada).
- **Lista**: as tarefas do quadro em linhas, como no Redmine, agrupadas por versão, situação, responsável ou tipo e ordenáveis por coluna, com o cabeçalho fixo ao rolar. Cada quadro lembra a visualização, os filtros e a ordenação.
- Notificações do quadro (opcional): cards que entram, saem ou mudam de coluna, comentários e menções.
- Cards com prioridade em destaque, etiquetas de versão e prazo, responsável e "parada há N dias"; contadores clicáveis de atrasadas, prioridade alta, paradas e sem responsável.
- **Resumo do quadro**: indicadores, distribuição por status, tabela por pessoa, por tipo e por prioridade; nos quadros de sprint, datas, ritmo (fechadas × tempo), fechadas na semana e abertas por dia útil.
- Cores de status e níveis de prioridade automáticos, ajustáveis em Configurações → Aparência.

**Horas**

- Lançar, editar e excluir horas no detalhe da tarefa; cronômetro na barra lateral e na bandeja (pausa ao dormir e por ociosidade); tela Minhas horas com a semana, grade tarefas × dias e repetir semana passada.

**Notificações**

- Monitor em segundo plano (continua na bandeja ao fechar a janela).
- **Monitores**: "Minhas tarefas" (atribuídas/observadas/criadas por mim) + quantos quiser de consulta salva, filtro por URL ou quadro, cada um com os próprios avisos (nova tarefa, atribuição, status, comentário, menção, outras alterações, entrou/saiu) e horário opcional. Alterações feitas por você mesmo não notificam.
- Saída de tarefa: avisa quando uma tarefa sai da sua fila (passada para outra pessoa ou fechada), dizendo quem fez.
- A mesma alteração vista por dois monitores vira uma notificação só ("via …").
- Janela de horário opcional, som, abrir ao iniciar o sistema, contador na bandeja/dock.
- Mais de 4 eventos num ciclo viram uma notificação resumida.
- Clicar numa notificação de tarefa (no app ou no sistema) abre a tarefa no próprio app.

**Log**

- Tela com cada requisição ao Redmine (tempo, tamanho, status) e os passos do monitor, guardada em `logs/activity.log`; dá para filtrar e apagar.

Regras de negócio em [`docs/REGRAS-DE-NEGOCIO.md`](docs/REGRAS-DE-NEGOCIO.md); funcionamento interno (timers, requisições, arquivos, segurança) em [`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md).

## Arquitetura

Clean Architecture + Ports & Adapters + DDD, com atomic design na interface. Detalhes, regras de dependência e o passo a passo
para adicionar funcionalidades estão em [`PROJECT.md`](PROJECT.md) (§4).

```
src/
  domain/          regras de negócio puras (sprints, quadros, agenda, notificações, monitor) + testes
  application/     casos de uso e portas (interfaces)
  infra/           adaptadores: Redmine HTTP, arquivos JSON, safeStorage, notificações do Electron
  main/            composition root, IPC, janela e bandeja
  contracts/       contrato IPC tipado entre main e interface
  shared/i18n/     pt-BR e en-US + formatadores
  renderer/        React: pages → templates → organisms → molecules → atoms
```

| Comando          | O que faz                                        |
| ---------------- | ------------------------------------------------ |
| `npm run check`  | Tipos + lint (com fronteiras de camada) + testes |
| `npm test`       | Testes (Vitest)                                  |
| `npm run format` | Prettier                                         |

### Como o monitor detecta mudanças

1. Guarda uma marca d'água com o maior `updated_on` visto (relógio do servidor). Na primeira execução só grava a marca.
2. A cada ciclo busca `/issues.json?updated_on=>=<marca>&status_id=*` para cada escopo (`assigned_to_id=me`, `watcher_id=me`, `author_id=me`).
3. Para cada tarefa alterada, lê `?include=journals` e converte os journals novos (de outras pessoas) em eventos.
4. Consultas personalizadas comparam o conjunto de IDs com o snapshot anterior.

## Distribuição

- **macOS:** o build usa assinatura ad-hoc (`identity: '-'`). Sem nenhuma assinatura o macOS descarta as notificações em silêncio. No primeiro uso: botão direito no app → Abrir. Para distribuir sem esse aviso, configurar certificado Developer ID + notarização no `electron-builder.yml`.
- **Dev no macOS:** o Electron do npm vem sem assinatura; o `postinstall` (ou `npm run sign:dev`) aplica assinatura ad-hoc. Em dev o app aparece como **Electron** nos Ajustes de Notificações.
- **Permissão de notificações:** ao abrir, o app verifica o registro da Central de Notificações e mostra um modal se a permissão estiver pendente ou bloqueada (Configurações → Monitoramento mostra o estado).
- **Windows:** o `appId` precisa bater com `app.setAppUserModelId` para as notificações funcionarem (já configurado).

## Próximos passos

- Agenda (prazos, versões e eventos próprios)
- Integração com o Mattermost
- Atualização automática
