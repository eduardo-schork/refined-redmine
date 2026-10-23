# Novidades

Versões do Refined Redmine. A versão instalada aparece em **Configurações → Geral → Sobre**.

## 0.11.0 — cores, notificações e modais por aba

- **Cores mais personalizáveis** (Configurações → Aparência → Cores): conjuntos de cores prontos (Padrão, Vívido, Suave e Para daltônicos), cada um com cores para o tema claro e o escuro, e troca de qualquer cor: famílias de status, prioridades, previsão (vencida, hoje, em breve) e mensagens de sucesso, atenção e erro. Prévia com cards de exemplo.
- **Status e prioridades mais fáceis de colorir**: em vez de listas, cada status mostra as bolinhas das famílias de cor e cada prioridade os botões Urgente, Alta, Normal e Baixa; no **+** dá para escolher qualquer cor só para aquele status ou prioridade.
- **Novo ícone azul** (`#0085ff`) e cor de destaque padrão **Azul Refined**, a mesma do ícone. Quem já usa outra cor continua com ela; o azul está em Configurações → Aparência → Cor de destaque.
- **Cor por tipo de tarefa**: Defeito, Funcionalidade, Suporte… aparecem com um ponto colorido nos cards, na lista e no detalhe; a cor vem do nome e pode ser trocada.
- **Faixa dos cards**: escolha se a faixa colorida à esquerda mostra a prioridade, o status, o tipo ou nada, e se o card ganha um fundo levemente colorido.
- **Notificações como caixa de entrada**: agrupadas por dia, filtros por tipo (menções, comentários, situação…) com contagem e por monitor, mudança de situação de → para, trecho do comentário, e ações em cada linha: marcar como lida ou não lida, abrir no Redmine e remover. Teclado: setas ou j/k, Enter, `e` e Delete.
- **Cada aba com o seu detalhe de tarefa**: a tarefa aberta num quadro fica naquela aba; troque de aba (a barra de abas e o menu continuam clicáveis) e volte com a tarefa e o comentário pela metade no lugar. As tarefas abertas voltam junto com as abas ao abrir o app.
- **Log escondido**: a tela Log saiu do menu; abra em Configurações → Geral → Diagnóstico ou ligue lá para ela voltar ao menu.
- **Correções**: a cor da previsão na Lista dos quadros agora respeita os dias de "vence em breve"; Esc e os atalhos da Agenda não reagem mais a janelas de abas escondidas; o ⌘N usa o projeto e a sprint do quadro da frente.

## 0.10.0 — trâmites, abas e horas do time

- **Trâmites**: botões no detalhe da tarefa, configurados em Configurações → Automações. "Enviar para QA" (por exemplo) acha a tarefa de Qualidade ligada, cita as notas escolhidas num comentário, muda situação e responsável dela, lança as horas e pode fechar as tarefas de desenvolvimento. O **Novo trâmite** faz comentário, situação, responsável, versão e horas da própria tarefa de uma vez. Cada nota do histórico ganhou o botão "Enviar este trâmite".
- **Abas**: cada tela e cada quadro abrem numa aba no topo, como no navegador. As abas de trás guardam filtros, rolagem e formulários. Arraste para reordenar, duplique uma aba (dois quadros iguais com filtros diferentes), feche as outras e abra em aba nova com ⌘-clique ou clique do meio no menu. Ctrl+Tab passa entre elas e ⌘1…9 vai direto para uma. As abas voltam ao abrir o app, e dá para desligá-las em Configurações → Geral → Abas.
- **Alterar em massa**: situação, responsável e versão da tarefa, da pai, das relacionadas e das subtarefas de uma vez, por exemplo para levar uma história e as tarefas dela para a sprint.
- **Tempo do time**: horas por pessoa e por dia de um time montado com pessoas dos projetos, com médias e o detalhe por tarefa ou atividade.
- **Horas extras**: banco de horas extras no app, com saldo, meses no banco ou pagos e gráfico do ano. Ao lançar horas, informe quanto foi hora extra.
- **Campos personalizados ao criar tarefa**: o formulário mostra os campos do tipo escolhido (por exemplo Módulo, Solicitante, Categoria), com os valores já usados no projeto como sugestão e `*` nos que todas as tarefas recentes do tipo preenchem. Corrige a criação em Redmines que recusavam por falta desses campos. Numa **Nova subtarefa**, eles vêm com os valores da tarefa pai.
- **Imagens no meio da descrição e dos comentários**: o print anexado e citado no texto aparece como miniatura no lugar, em vez de um link que abria uma página quebrada do Redmine; clique para ver maior.
- **Vídeos e áudios tocam no app**: na aba Anexos, MP4, MOV, WebM, MP3, M4A e outros formatos comuns abrem num player dentro do app, sem ir para o app do sistema.
- **Atualizações sem token**: o código do app agora é público, e o app procura e baixa versões novas sem precisar de token do GitHub (ele fica opcional, só para quem esbarrar no limite de consultas). O instalador baixado é conferido contra o SHA-256 publicado no GitHub.

## 0.9.0

- **Criar tarefas pelo app**: o botão com lápis ao lado de Buscar, o atalho **⌘N** (Ctrl+N no Windows) e **Nova tarefa** no topo dos quadros abrem um formulário com projeto, tipo, título, descrição, anexos, prioridade, responsável, versão, tarefa pai, datas e estimativa. Num quadro, o projeto e a sprint já vêm preenchidos. A tarefa criada abre em seguida.
- **Anexos ao criar**: escolha, arraste ou cole uma captura de tela. Cada arquivo aparece como cartão, igual aos da aba Anexos, com miniatura das imagens, e abre para conferir antes de criar.
- **Nova subtarefa** no detalhe da tarefa (aba Tarefas relacionadas), já com a tarefa pai, o projeto e a versão dela.
- **Editar mais campos no detalhe**: o lápis ao lado do título e o botão **Editar** da descrição abrem a edição, e a lateral ganhou **Tipo**, **Estimado** e **Tarefa pai**.
- **Descrição longa recolhida**: descrições grandes aparecem cortadas em 25 linhas, com **Mostrar tudo**, para as abas de tarefas relacionadas, anexos e horas ficarem visíveis logo ao abrir.
- **Notificações abrem a tarefa no app**: clicar numa notificação sobre uma tarefa, na tela Notificações ou na notificação do sistema, abre o detalhe no próprio app em vez do Redmine no navegador.
- **Cabeçalho fixo na Lista dos quadros**: ao rolar, os nomes das colunas continuam visíveis e clicáveis para ordenar.

## 0.8.0 — detalhe da tarefa com abas, relações e anexos

- **Abas no detalhe da tarefa**: Tarefas relacionadas (aberta por padrão), Anexos e Horas ficam em abas abaixo da descrição, uma de cada vez, com a quantidade de cada uma ao lado do nome.
- **Subtarefas e relações mais completas**: na aba Tarefas relacionadas, cada subtarefa e tarefa relacionada mostra o número, o título, o status e o responsável. As relações ficam agrupadas pelo tipo (bloqueada por, bloqueia, relacionada a…), as subtarefas mostram quantas já foram fechadas e as fechadas aparecem riscadas.
- **Anexos dentro do app**: na aba Anexos, imagens aparecem em miniatura e abrem numa visualização com setas para passar entre elas; arquivos de texto, log e JSON também abrem no app. PDF, documentos, planilhas e vídeos abrem no app do sistema; arquivos compactados e programas, por segurança, só pelo Redmine.

## 0.7.0 — horas, cronômetro, lista e filtros nos quadros

- **Lançar horas** direto no detalhe da tarefa: data, horas do jeito que preferir (1,5 · 1:30 · 1h30 · 90m), atividade e comentário. A seção Horas mostra o total contra o estimado e todos os lançamentos, com editar e excluir os seus.
- **Cronômetro**: comece a contar numa tarefa e pare quando terminar; o tempo vai pronto para o lançamento. Ele aparece na barra lateral e na barra de menus, continua com a janela fechada e pausa sozinho quando o computador dorme ou você fica fora por 10 minutos.
- **Minhas horas**: a sua semana numa tela só, com o total de cada dia, uma grade tarefas × dias (clique para lançar) e o botão Repetir semana passada. No Início, o indicador Horas hoje.
- **Lista nos quadros**: além de Quadro e Resumo, a aba **Lista** mostra as tarefas em linhas, como a lista do Redmine (número, tipo, situação, prioridade, título, responsável, versão e previsão), agrupadas por versão, situação, responsável ou tipo. Clique no nome de uma coluna para ordenar.
- **Filtros rápidos nos quadros**: abaixo do título, filtre por responsável, tipo, situação e versão, marcando uma ou mais opções de cada. Valem no quadro e na lista, e cada quadro lembra os filtros e a visualização escolhida.
- **Login sem espera**: depois de conectar, o Início abre na hora. Antes, a tela de conexão podia ficar parada por minutos mesmo com a conexão já feita.
- **Tela de conexão com retorno**: mostra o progresso e os segundos, avisa quando está demorando e, se der errado, explica o motivo e o que fazer (chave recusada, endereço que não é de um Redmine, API desligada, VPN ou rede, certificado). Sem resposta em 30 segundos, mostra o erro em vez de ficar esperando.
- **Endereço mais fácil**: pode digitar sem `https://` ou colar o link de uma página do Redmine, que o app ajusta. Depois de desconectar, o endereço já vem preenchido.

## 0.6.0 — publicação automática

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
