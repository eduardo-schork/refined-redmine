# Novidades

Versões do Refined Redmine. A versão instalada aparece em **Configurações → Geral → Sobre**.

## Próxima versão

- **Quadro Ágil**: um quadro com todas as suas tarefas abertas, uma coluna por situação, aparece no topo da lista. Depois é um quadro como os outros: renomeie, mude as colunas ou exclua (ele não volta).
- **Reordenar quadros**: arraste os quadros na barra lateral.
- **Agrupar o quadro**: o **Agrupar por** agora vale também no modo Quadro, com raias por versão, situação, responsável ou tipo. Na **Lista**, o começo de cada grupo ficou bem mais visível.
- **Menu ⋮ nos cards e na Lista**: abrir, alterar situação, alterar em massa, novo trâmite, os seus trâmites e ações do Claude e abrir no Redmine, sem abrir a tarefa. Enquanto a tarefa carrega para abrir uma ação, o ⋮ fica girando.
- **Editor de quadro**: primeiro a origem das tarefas, depois o nome, que já vem com o nome da consulta salva (ou do projeto, ou da sprint).
- **Listas com busca**: consultas salvas, projetos, sprints, versões e pessoas têm um campo para filtrar, e a lista abre por cima da janela (corrige a lista de projetos do **Novo time**, que criava rolagem dentro do formulário).
- **Monitores no menu**: os monitores ganharam tela própria na barra lateral, e um monitor pode avisar **pela quantidade de tarefas** ("menos de 2" na fila de alguém, "mais de 10" defeitos abertos), sem precisar de quadro.
- **Ações do Claude Code**: botões configuráveis (Configurações → Automações) que abrem o Claude Code na pasta do projeto, ou um chat no app Claude, com um prompt sobre a tarefa (ex.: `/review refs {{tarefa}}`), e podem mudar a situação ao abrir.
- **Editor de comentários como o do Redmine**: Escrever e Visualizar, barra de formatação e imagem colada (⌘V) entrando como anexo e no texto. Vale para o comentário do histórico (que passou a aceitar anexos), os trâmites e a descrição.
- **Detalhe da tarefa**: botão **Atualizar** ao lado de "Abrir no Redmine"; copiar número, link, título e descrição direto no campo (os botões de copiar saíram da linha de ações); histórico em ordem crescente ou decrescente, lembrada; em telas grandes o detalhe fica maior e dá para redimensionar arrastando o canto.
- **Horas**: resumo por pessoa e atividade na aba Horas; **Lançar horas** também troca a situação e o responsável (por padrão continuam os atuais); o cronômetro pode mudar a tarefa para uma situação ao iniciar (ex.: Em andamento).
- **Horas dos trâmites**: vêm do cronômetro quando ele está rodando na tarefa; sem ele, escolha **contar desde** qual trâmite (padrão: o seu último), e o tempo é dividido pelo expediente em horas normais e hora extra (expediente em Configurações → Automações).
- **Agenda**: repetição **mensal no último dia útil** (ex.: lembrete da NFS-e).
- **Colunas sugeridas**: ao criar um quadro, as colunas já vêm com as situações em que as tarefas da origem estão (ex.: só "Nova", "Em andamento" e "Em pausa" para uma consulta de defeitos abertos); **Sugerir pelas tarefas** refaz.
- **Janelas maiores e proporcionais**: o detalhe da tarefa ocupa 85% da área (e o tamanho que você arrastar fica guardado como proporção); o Novo trâmite, o envio para outra tarefa, Alterar em massa e as tarefas da sprint ficam largos; os outros formulários também crescem com a tela, sem esticar demais em monitores muito largos.
- **Árvore de tarefas mais fácil**: em Alterar em massa e em "Aplicar também em", clique em qualquer ponto da linha para marcar, e cada subtarefa aparece recuada com `├─`/`└─` embaixo da tarefa pai.
- **Indicador de carregamento**: uma linha animada sob o título mostra quando Tempo do time, Minhas horas, quadros, Sprints, Início e o detalhe da tarefa estão buscando dados.
- **Mais organizado**: Novo trâmite depois dos trâmites e ações configurados (no detalhe e no menu ⋮), **Monitores** logo acima dos quadros no menu, muito mais ícones para as automações e o aviso por quantidade como mais um item de "Notificar quando".
- **Backup das configurações** (Configurações → Backup): exporte quadros, monitores, automações, times, expediente, aparência e preferências num arquivo JSON e importe de volta, em outro computador ou depois de um engano. Não leva a conexão, a API key nem o token do GitHub.
- **Telas grandes mais bem aproveitadas**: o Início vira uma grade de cartões (Minha fila; Paradas e Prazos; agenda e notificações) com uma, duas ou três colunas conforme a largura, e a saudação divide a linha com a busca, Monitores mostra os monitores em colunas e Notificações passa os tipos para uma coluna à esquerda; Sprints, Minhas horas e Tempo do time ficam mais largas.
- **Horas extras**: altere um lançamento pelo lápis (data, horas, tarefa e descrição). Clicar num mês do gráfico ou da lista filtra os lançamentos, como uma célula do Tempo do time: o mês fica contornado e o ✕ volta a mostrar todos. A tela fica com um bloco embaixo do outro.
- **Verificação mais leve em quadros grandes**: um quadro com mais de 500 tarefas (por exemplo, todas as suas, incluindo as fechadas) deixa de baixar 500 tarefas a cada verificação; o app só conta e busca as que mudaram desde a última vez.
- **Alterar em massa explica o que falhou**: no fim, um aviso lista cada tarefa que não foi aplicada por completo e o motivo (o mesmo nos trâmites).
- **Automações novas sem nome pronto**: o campo mostra um exemplo em vez de vir preenchido.
- **Correções**: clicar numa imagem citada na descrição ainda recolhida abria a visualização cortada e sem como fechar; listas com busca e menus (⋮, copiar, filtros do quadro) agora fecham ao clicar fora, inclusive dentro do detalhe da tarefa e dos editores, ao ir para outro campo ou ao trocar de janela; o card arrastado no quadro voltou a ficar junto do ponteiro do mouse; o Tempo do time, Minhas horas, "Horas hoje" e Repetir semana deixavam de fora o primeiro dia do período (a segunda-feira de "Esta semana" e de "Semana passada") por causa do fuso horário no Redmine; quadros, consultas e filtros agora avisam a mudança (situação, comentário, menção) de uma tarefa que **saiu do resultado**, mesmo com "Tarefa saiu" desligado (antes, um colega mudar a situação e tirar a tarefa da consulta não notificava nada), e uma alteração feita enquanto a verificação rodava não se perde mais (cada monitor guarda até onde já viu).

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
