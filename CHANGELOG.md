# Novidades

Versões do Refined Redmine. A versão instalada aparece em **Configurações → Geral → Sobre**.

## Próxima versão — publicação automática

- **Versões novas publicadas automaticamente**: cada versão agora é gerada e publicada pelo próprio GitHub, sem depender de um computador específico. Para você nada muda: a atualização continua chegando pelo app.
- A 0.5.0 não chegou a ser publicada. Quem está na 0.4.0 recebe as novidades dela junto com esta versão: ações rápidas no detalhe da tarefa (Atribuir a mim e copiar link, número e título), responsável que só muda com clique e intervalo configurável das atualizações.

## 0.5.0 — ações rápidas e responsável mais seguro

- **Ações rápidas no detalhe da tarefa**: abaixo das etiquetas, **Atribuir a mim** (um clique para pegar a tarefa) e botões para copiar o link, o número, o título, o "#número e título" ou um link em Markdown.
- **Responsável só muda com clique**: o campo de responsável abre uma lista com busca, e a troca só acontece ao clicar no nome. Antes, digitar uma letra com o campo selecionado podia trocar o responsável sem querer.
- **Intervalo das atualizações** (Configurações → Geral → Atualizações): procure versões novas a cada 1 hora, 4 horas, 12 horas, uma vez por dia ou uma vez por semana.

Quem está na 0.4.0 recebe esta versão pelo próprio app.

## 0.4.0 — resumo do quadro e cards reformulados

- **Resumo do quadro**: ao lado de cada quadro, a aba **Resumo** mostra os números do quadro, a distribuição por status, uma tabela por pessoa (clique para ver os cards dela), e as tarefas por tipo e por prioridade.
- **Sprint no resumo**: nos quadros de sprint, o resumo mostra as datas com os dias que faltam, se a sprint está no ritmo (tarefas fechadas contra o tempo que já passou), quantas foram fechadas na última semana, quantas faltam fechar por dia útil e quantas entraram depois do início.
- **Cards do quadro reformulados**: prioridade em destaque (etiqueta e borda colorida), versão e previsão em etiquetas próprias, com "amanhã" ou "ontem" e cores quando o prazo está perto ou vencido, e o responsável em linha separada, com "parada há N dias" quando a tarefa não anda.
- **Contadores no quadro**: atrasadas, prioridade alta, paradas e sem responsável; clique para ver só essas. Cada coluna mostra as suas atrasadas e de prioridade alta.
- **Cores de status**: cada status ganha uma cor pela sua fase (nova, em andamento, em aprovação, em teste, em pausa, concluída), nas colunas, nos cards e nas listas.
- **Cores das tarefas** (Configurações → Aparência): troque a cor de um status, diga qual prioridade é urgente, alta, normal ou baixa, e quantos dias antes a previsão fica em destaque.
- **Início**: novo indicador de prioridade alta, números coloridos quando pedem atenção e clicáveis, e prioridade nas listas.
- **Detalhe da tarefa**: status, prioridade, prazo e versão logo abaixo do título.
- **Leitura mais fácil**: textos um pouco maiores em todo o app, botões que não quebram o texto e botões de ícone maiores e mais visíveis.

Quem está na 0.3.0 recebe esta versão pelo próprio app (Configurações → Geral → Atualizações).

## 0.3.0 — busca rápida e edição de campos

- **Busca rápida**: `⌘K` no Mac ou `Ctrl+K` no Windows, em qualquer tela (ou **Buscar** no menu). Digite `#1234` para abrir a tarefa ou parte do título para achá-la em qualquer projeto e status. Também leva aos quadros e às telas e mostra as últimas tarefas que você abriu. No Início, a busca fica logo abaixo da saudação.
- **Editar a tarefa no detalhe**: prioridade, responsável, versão, datas de início e previsão e % concluído, direto na lateral. Cada mudança é salva no Redmine na hora. Se o Redmine não aplicar algum campo (por exemplo, a versão travada pelo fluxo), o app avisa.

Quem está na 0.2.0 recebe esta versão pelo próprio app (Configurações → Geral → Atualizações).

## 0.2.0 — atualizações pelo GitHub

- **Atualizações**: com o seu token do GitHub (Configurações → Geral → Atualizações), o app avisa quando sai versão nova, baixa o instalador e, no Windows, atualiza e reabre sozinho. No Mac, abre o `.dmg` para você arrastar para Aplicativos. Sem token, nada muda.
- **O que há de novo**: depois de atualizar, o app mostra uma vez as novidades da versão.
- **Notificações confirmadas por você**: o app envia uma notificação de teste e pergunta se ela apareceu. Antes, ele podia dizer "Permitidas" mesmo com as notificações desligadas nos ajustes do sistema. Quem atualizar vai ver essa confirmação uma vez.
- **Verificação ao acordar**: depois que o computador sai do repouso, o Redmine é verificado em 10 segundos, sem esperar o intervalo.
- **Copiar informações de suporte** (Configurações → Geral → Sobre), para colar na conversa quando algo der errado.
- Instruções de instalação para macOS e Windows em `docs/INSTALACAO.md`.

Quem está na 0.1.0 instala a 0.2.0 manualmente, por cima (a 0.1.0 ainda não sabe se atualizar). Daí em diante, as versões chegam pelo próprio app.

## 0.1.0 — primeira versão (piloto interno)

Primeira versão para uso no time: macOS (`.dmg`) e Windows (`.exe`).

- **Início**: sua fila, tarefas paradas e atrasadas, prazos, sprints ativas, agenda do dia e últimas notificações.
- **Quadros kanban**: a partir das suas tarefas, de um projeto, de uma consulta salva, de um filtro copiado do Redmine (URL) ou de uma sprint (fixa ou automática). Arrastar um card muda o status no Redmine, respeitando o fluxo. Raias por responsável, busca e filtro por pessoa.
- **Detalhe da tarefa**: descrição, anexos, relações, histórico, troca de status e comentários sem sair do app.
- **Sprints**: fases calculadas (em desenvolvimento, homologação, produção, correção…), prazos e progresso.
- **Agenda**: compromissos locais com repetição como no Google Agenda, lembretes com notificação do sistema, prazos das sprints e das suas tarefas.
- **Notificações e monitores**: "Minhas tarefas" mais monitores de consulta, filtro ou quadro, cada um com os próprios avisos (entrou/saiu, status, comentário, menção…). Suas próprias alterações não notificam.
- **Log**: cada requisição ao Redmine com tempo e tamanho, e os passos do monitor.
- **Aparência**: tema claro/escuro/do sistema, paletas, cor de destaque e tamanho da interface.
- Português e inglês.

Limitações conhecidas desta versão:

- O app não tem assinatura da Apple (Developer ID): na primeira abertura o macOS avisa que o desenvolvedor não foi verificado.
- Não há atualização automática: cada versão nova é instalada por cima da anterior (os dados são mantidos).
