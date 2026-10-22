# Refined Redmine — Manual do usuário

O Refined Redmine é um app de desktop (macOS e Windows) que fica por cima do Redmine da empresa. Ele junta um painel com o seu dia, quadros kanban que mudam o status no Redmine ao arrastar, uma visão das sprints, uma agenda com lembretes e notificações do sistema operacional.

Não há servidor próprio: o app fala direto com o Redmine usando a sua chave de API, e tudo o que é local (quadros, agenda, histórico de notificações) fica salvo só no seu computador.

> As capturas de tela deste manual usam dados fictícios (projeto "Loja Virtual", usuária "Marina Costa").

## Sumário

1. [Primeiros passos](#1-primeiros-passos)
2. [Início](#2-início)
3. [Quadros kanban](#3-quadros-kanban)
4. [Detalhe da tarefa](#4-detalhe-da-tarefa)
5. [Sprints](#5-sprints)
6. [Agenda](#6-agenda)
7. [Notificações e monitores](#7-notificações-e-monitores)
8. [Log](#8-log)
9. [Configurações](#9-configurações)
10. [Atalhos e perguntas frequentes](#10-atalhos-e-perguntas-frequentes)

## 1. Primeiros passos

### Instalar

O passo a passo (macOS e Windows, com os avisos de segurança do sistema na primeira abertura) está em [Instalar o Refined Redmine](INSTALACAO.md). Versões novas são instaladas por cima da anterior; quadros, agenda e preferências são mantidos.

### Conectar ao Redmine

![Tela de conexão](images/onboarding.png)

1. Em **URL do Redmine**, informe o endereço que você usa no navegador (ex.: `https://redmine.suaempresa.com.br`). Pode digitar sem `https://` ou colar o endereço de uma página do Redmine (como `…/my/account` ou `…/issues/1234`): o app ajusta e mostra embaixo o **Endereço usado**. Depois de desconectar, o endereço já vem preenchido.
2. Em **Chave de acesso à API**, cole a sua chave. No Redmine: **Minha conta → Chave de acesso à API → Mostrar**. O link **Abrir "Minha conta" no Redmine** abre essa página no navegador; o ícone de olho mostra ou esconde a chave.
3. Clique em **Conectar**. Enquanto conecta, os campos ficam travados e aparece **Conectando a …** com os segundos. Se passar de 8 segundos, o app avisa o que conferir (VPN, rede). Sem resposta em 30 segundos, ele mostra o erro.

Se não der certo, o app diz o motivo e o que fazer: chave recusada, endereço que não é de um Redmine, API REST desligada no Redmine, endereço não encontrado (DNS ou VPN), tempo esgotado ou conexão segura recusada (proxy, antivírus, certificado). Ao corrigir um campo, o aviso some.

A chave é guardada criptografada pelo sistema (Keychain no macOS, DPAPI no Windows) e nunca sai do seu computador, a não ser nas chamadas ao próprio Redmine.

### Confirmar as notificações

Enquanto as notificações não estiverem confirmadas, o app abre a janela **Confirmar notificações**. Clique em **Enviar notificação de teste** e responda **Apareceu** ou **Não apareceu**. A confirmação é necessária porque o sistema não avisa o app quando descarta uma notificação (por exemplo, com as notificações do app desligadas nos Ajustes).

- **Não apareceu**: o app mostra onde ligar as notificações. No macOS, **Ajustes do Sistema → Notificações → Refined Redmine → Permitir notificações** (estilo **Alertas** ou **Faixas**); no Windows, **Configurações → Sistema → Notificações**. Depois clique em **Testar de novo** e confirme.
- Dá para refazer o teste a qualquer momento em **Configurações → Notificações → Enviar notificação de teste**.

### Bandeja do sistema

Fechar a janela não encerra o app: ele continua na bandeja (barra de menus no macOS), verificando o Redmine e disparando lembretes. Pelo ícone da bandeja você abre o app, a Agenda ou as Notificações, força uma verificação (**Verificar agora**) ou sai (**Sair**).

## 2. Início

![Tela Início](images/home.png)

O painel resume o seu dia:

- **Barra de busca**, logo abaixo da saudação: a mesma [busca rápida](#busca-rápida), direto na tela. Clique nela (ou use `Tab`) e digite; os resultados abrem logo abaixo.
- **Indicadores**: tarefas na sua fila, de prioridade alta, paradas, atrasadas e notificações não lidas. Os números ficam amarelos ou vermelhos quando pedem atenção; clique em um para ir ao painel correspondente.
- As listas mostram a **prioridade** (quando não é Normal) e a versão de cada tarefa.
- **Sprints**: cartões das sprints ativas com fase, prazo dos devs, data de publicação e progresso. **Ver sprints** abre a tela completa.
- **Agenda de hoje**: os compromissos do dia. **Abrir agenda** leva à Agenda.
- **Minha fila**: suas tarefas abertas, com contagem por status.
- **Paradas**: tarefas sem movimentação há vários dias (padrão: 5, ajustável em Configurações) ou em pausa/aguardando.
- **Prazos**: tarefas vencidas ou que vencem nos próximos 7 dias.

Clique em qualquer tarefa para abrir o [detalhe da tarefa](#4-detalhe-da-tarefa).

### Busca rápida

![Busca rápida](images/search.png)

Aperte `⌘K` (Mac) ou `Ctrl+K` (Windows), em qualquer tela, ou clique em **Buscar** no topo do menu lateral. No Início, a barra de busca abaixo da saudação faz o mesmo sem abrir a janela.

![Busca no Início](images/home-search.png)

- Sem digitar nada, aparecem as **tarefas recentes** (as últimas que você abriu), os quadros e as telas do app.
- **Número da tarefa**: digite `#1234` ou só `1234` e aperte `Enter` para abrir a tarefa.
- **Texto**: a partir de 2 letras, busca no título das tarefas de todos os projetos que você vê, em qualquer status (até 20 resultados, das mais recentes para as mais antigas).
- Quadros e telas também são filtrados pelo texto, sem diferenciar acentos ("configuracoes" acha "Configurações").
- Navegue com `↑` `↓`, abra com `Enter` e feche com `Esc`.

![Resultados da busca](images/search-text.png)

## 3. Quadros kanban

![Quadro "Minha fila"](images/board.png)

Os quadros ficam na barra lateral, em **Quadros**. Cada coluna agrupa um ou mais status do Redmine.

- **Arrastar um card para outra coluna muda o status no Redmine.** O app só permite soltar onde a transição é aceita pelo fluxo de trabalho da tarefa.
- No topo, **Quadro | Lista | Resumo** troca a forma de ver o quadro (veja [Lista](#lista) e [Resumo do quadro](#resumo-do-quadro)).
- **Nova tarefa**, no topo, cria uma tarefa já no projeto do quadro e, no quadro de uma sprint, já na versão da sprint (veja [Criar uma tarefa](#criar-uma-tarefa)).
- Os ícones no canto superior direito atualizam, editam e excluem o quadro.

### Filtros rápidos

![Filtros rápidos](images/board-filters.png)

Na linha abaixo do título, valem tanto para o quadro quanto para a lista:

- **Buscar** filtra por título, `#id` ou projeto.
- **Responsável**, **Tipo**, **Situação** e **Versão** abrem uma lista com o que existe no quadro e quantas tarefas tem cada opção. Marque uma ou mais; nenhuma marcada é "Todos". Responsável tem "Sem responsável" e Versão tem "Sem versão".
- Filtros diferentes se somam (Tipo Defeito **e** Situação Em andamento); opções do mesmo filtro valem qualquer uma (Defeito **ou** Funcionalidade).
- **Limpar filtros** aparece quando há algum filtro e tira todos. Dentro de cada lista, **Limpar este filtro** tira só aquele.
- Com filtro, o título mostra **"3 de 6 tarefas"**.
- Cada quadro lembra os seus filtros, a forma de ver (quadro, lista ou resumo), o agrupamento e a ordenação, mesmo depois de fechar o app.

**Contadores de atenção**, abaixo dos filtros: quantas tarefas do quadro estão **atrasadas**, com **prioridade alta**, **paradas** ou **sem responsável** (só aparecem os que têm alguma). Clique em um para ver só essas tarefas; clique de novo para voltar a ver todas. Eles contam só as tarefas que passam pelos filtros.

Ao lado do nome de cada coluna, além do total, aparecem em vermelho as **atrasadas** e em amarelo as de **prioridade alta** daquela coluna.

Cada card tem uma informação por linha:

1. **Número e tipo**, e à direita a **prioridade**, quando não é Normal: **Urgente/Imediata** em vermelho, **Alta** em amarelo, **Baixa** em cinza. A borda esquerda do card também fica vermelha ou amarela.
2. **Título**.
3. **Etiquetas**: versão, previsão (vermelha se venceu ou vence hoje, amarela se vence em até 3 dias (ajustável), com "ontem", "amanhã", "em 2 dias"), o status quando a coluna junta mais de um e o projeto quando o quadro tem mais de um.
4. **Responsável** (ou "Sem responsável") e quando a tarefa mudou pela última vez. Se ela está parada, aparece "parada há N dias" em amarelo.

A barra verde embaixo é o percentual concluído.

**Cores dos status**: o Redmine não tem cores de status, então o app escolhe uma pelo nome (dá para trocar em [Cores das tarefas](#cores-das-tarefas)): cinza para novas, azul para em andamento, roxo para em aprovação ou revisão, verde-água para em teste ou homologação, amarelo para em pausa ou aguardando, verde para resolvidas e fechadas, cinza apagado para rejeitadas ou canceladas. A cor aparece na bolinha do cabeçalho de cada coluna, nas etiquetas de status dos cards, das listas do Início e do detalhe da tarefa, e no resumo do quadro.

### Lista

![Lista do quadro](images/board-list.png)

**Lista** mostra as tarefas do quadro em linhas, como a lista de tarefas do Redmine: número, tipo, situação, prioridade, título, responsável, versão e previsão (vermelha se venceu, amarela se vence em breve).

- **Agrupar por** (à direita dos filtros): versão (padrão), situação, responsável, tipo ou nenhum. Cada grupo mostra quantas tarefas tem; clique no nome do grupo para recolher ou abrir. Versões seguem a ordem das versões (3.9 antes de 3.10), situações a ordem do Redmine, e o grupo "Sem versão" ou "Sem responsável" fica por último.
- **Cabeçalho fixo**: ao rolar a lista, os nomes das colunas continuam visíveis no topo, e dá para ordenar sem voltar para cima.
- **Ordenar**: clique no nome de uma coluna; clique de novo para inverter. A seta mostra a coluna e o sentido. O padrão é por prioridade, da mais urgente para a mais baixa. Tarefas sem responsável, sem versão ou sem previsão ficam no fim em qualquer sentido; empates mostram primeiro a atualizada mais recentemente.
- Clique em uma linha para abrir o detalhe da tarefa.

### Resumo do quadro

![Resumo do quadro](images/board-summary.png)

**Resumo** mostra os números do quadro. Ele usa **todas** as tarefas do quadro, sem a busca e os filtros rápidos.

- **Sprint** (só nos quadros de sprint), no topo:
  - **Datas**: início (estimado: o dia seguinte ao prazo dos devs da sprint anterior), prazo dos devs e publicação, com quantos dias faltam.
  - **Ritmo**: duas barras, o tempo de desenvolvimento que já passou e o percentual de tarefas fechadas. A etiqueta diz se a sprint está **No ritmo**, **Adiantada** ou **Atrás do ritmo** (diferença de mais de 15 pontos). Só aparece enquanto a sprint está em desenvolvimento.
  - **Fechadas nos últimos 7 dias**, **para fechar por dia útil** até o prazo dos devs, **entraram depois do início** (tarefas criadas durante a sprint, em amarelo quando há alguma) e **estimativa das abertas** em horas.
- **Indicadores**: total, abertas, fechadas (com o percentual), estimativa total em horas, atrasadas, prioridade alta, paradas e sem responsável.
- **Distribuição por status**: uma barra dividida na ordem das colunas, com a quantidade e o percentual de cada status.
- **Por pessoa**: abertas, fechadas, progresso (fechadas ÷ total), atrasadas, de prioridade alta, paradas e horas estimadas de cada responsável. **Clique em uma pessoa** para voltar ao quadro com o filtro de responsável dela.
- **Por tipo** e **Por prioridade**: quantas tarefas de cada tipo e de cada prioridade (da mais urgente para a mais baixa).

### Raias por responsável

![Quadro da sprint com raias](images/sprintboard.png)

Com **Raias por responsável** ativado, o quadro ganha uma linha por pessoa. No exemplo, o quadro **Sprint atual** acompanha automaticamente a sprint em desenvolvimento (**3.78 · automática**).

### Criar ou editar um quadro

![Editor de quadro](images/board-editor.png)

Clique no **+** ao lado de **Quadros**.

- **Nome**: como o quadro aparece na barra lateral.
- **Origem das tarefas**:
  - **Atribuídas a mim**: a sua fila.
  - **Projeto**: todas as tarefas de um projeto (com ou sem subprojetos).
  - **Consulta salva**: usa os filtros de uma consulta do Redmine. Aparecem as consultas públicas e as suas (inclusive as privadas). Criou uma agora no Redmine? Clique no botão de recarregar ao lado da lista.
  - **Filtro do Redmine (URL)**: filtre as tarefas na tela de tarefas do Redmine, copie o endereço da página e cole aqui. **Testar** mostra quantas tarefas o filtro traz. Serve para qualquer combinação de filtros, sem precisar salvar uma consulta.
  - **Sprint**: uma versão fixa, ou a sprint da fase escolhida (em desenvolvimento, em homologação ou correção), que troca sozinha quando a sprint muda. Pode mostrar só as suas tarefas.
- **Colunas**: **Uma por status** cria uma coluna por status para começar rápido; depois remova ou junte as que não precisar. **+ Coluna** cria uma coluna vazia.

### Notificações do quadro

![Notificações do quadro](images/board-notify.png)

No fim do editor, ligue **Notificar sobre este quadro** para ser avisado do que acontece nele, mesmo em tarefas que não são suas:

- **Tarefa entrou** / **Tarefa saiu**: um card apareceu ou sumiu do quadro (inclusive quando vai para um status que nenhuma coluna mostra).
- **Mudança de status**: quando o card troca de coluna, o aviso diz "moveu de _Em andamento_ para _Em aprovação_".
- **Novo comentário**, **Menção**, **Atribuída a mim** e **Outras alterações**, como nos outros monitores.

O quadro passa a aparecer também em **Configurações → Notificações → Monitores**, onde dá para ajustar as mesmas opções. Excluir o quadro exclui o monitor dele.

## 4. Detalhe da tarefa

![Detalhe da tarefa](images/modal.png)

Clicar em uma tarefa, em qualquer tela, abre o detalhe sem sair do app. As tarefas abertas ficam na lista de recentes da [busca rápida](#busca-rápida).

- **Título**: o lápis ao lado do título abre a edição. `Enter` salva e `Esc` cancela.
- **Descrição**, com formatação (listas, tabelas, negrito, links).
  - Descrição longa aparece **cortada em 25 linhas**, esmaecendo no fim, para as abas logo abaixo ficarem visíveis sem rolar. **Mostrar tudo** abre o resto; **Mostrar menos** volta.
  - **Editar**, ao lado de "Descrição", troca o texto por um editor com o Markdown da tarefa, como no Redmine. **Salvar** ou ⌘ + Enter (Ctrl + Enter no Windows) salva; **Cancelar** descarta. O `Esc` não fecha a tarefa enquanto você edita, para o texto não se perder.
- **Abas abaixo da descrição**: **Tarefas relacionadas** (aberta por padrão), **Anexos** e **Horas**, uma de cada vez. Ao lado do nome, cada aba mostra quantas tarefas ou anexos tem, ou as horas lançadas. As setas do teclado trocam de aba.
- **Histórico**, abaixo das abas: comentários e mudanças de campos.
- **Tarefas relacionadas**: as **Subtarefas** e as **Relações**. Cada tarefa aparece em uma linha com o **número** (clique na linha para abrir), o **título**, o **status** e o **responsável**. Passe o mouse no título para ver o tipo. Tarefas fechadas ficam com o número riscado.
  - As subtarefas mostram quantas já foram fechadas ("1 de 3 fechadas") com uma barra de progresso.
  - As relações ficam agrupadas pelo tipo, com o que segura a tarefa primeiro: **Bloqueada por**, **Bloqueia**, **Precede**, **Segue**, **Relacionada a**, **Duplica**, **Duplicada por**, **Copiada de** e **Copiada para**.
  - A tarefa pai aparece no topo, ao lado do número.
- **Resumo no topo**, abaixo do título: status, prioridade, previsão (colorida quando está perto ou vencida) e versão.
- **Ações rápidas**, logo abaixo:
  - **Atribuir a mim** passa a tarefa para você no Redmine, com um clique. Só aparece quando a tarefa não é sua; um aviso confirma, ou diz se o Redmine não aplicou (o fluxo pode não deixar você ser responsável naquela etapa).
  - **Lançar horas** abre o formulário de lançamento (veja [Horas](#lançar-horas)) e **Iniciar cronômetro** começa a contar o tempo nesta tarefa.
  - Os outros botões copiam para a área de transferência o **Link** da tarefa no Redmine, o **Número** (`#1234`), o **Título**, o **#Número e título** (`#1234 Título`, para mensagens e commits) ou um link em **Markdown** (`[#1234 Título](link)`). Um aviso mostra o que foi copiado.
- **Status**: troque direto pelo seletor; só aparecem os status permitidos para a tarefa.
- **Adicionar comentário**: aceita Markdown e é publicado no Redmine.
- **Campos editáveis na lateral**: tipo, prioridade, responsável, versão, início, previsão, % concluído, estimado e tarefa pai. Cada mudança é salva no Redmine na hora e confirmada com um aviso.
  - **Tipo**: os tipos habilitados no projeto da tarefa (Desenvolvimento, Defeito…).
  - **Estimado** e **Tarefa pai**: salvos ao sair do campo ou com `Enter`; apague para limpar. Texto que não é hora (ou número de tarefa) é recusado com um aviso.
  - **Responsável**: clique no campo para abrir a lista dos membros do projeto; digite para filtrar e **clique no nome** para trocar. Digitar ou usar as setas nunca troca o responsável sozinho, e `Esc` fecha a lista sem mudar nada. "Ninguém" tira o responsável.
  - **Versão**: lista as versões abertas do projeto; "Sem versão" tira a versão.
  - **Datas**: são salvas quando você sai do campo ou aperta `Enter`. Apague a data para limpá-la. O início não pode ser depois da previsão.
  - **% concluído**: de 10 em 10.
  - Se o Redmine não aplicar algum campo (por exemplo, quando o fluxo da tarefa deixa a versão só para leitura), aparece um aviso em vermelho dizendo qual campo não foi salvo.
- Também na lateral, só para leitura: horas gastas, autor, campos personalizados e observadores.
- **Nova subtarefa**, no canto da aba Tarefas relacionadas, cria uma tarefa filha desta (veja [Criar uma tarefa](#criar-uma-tarefa)).
- **Abrir no Redmine** abre a tarefa no navegador.

![Abas do detalhe, com as tarefas relacionadas](images/issue-links.png)

### Criar uma tarefa

![Nova tarefa](images/issue-new.png)

Para criar uma tarefa no Redmine sem sair do app, use o botão com lápis ao lado de **Buscar**, na barra lateral, o atalho **⌘N** (Ctrl+N no Windows) em qualquer tela, ou **Nova tarefa** no topo de um quadro. No detalhe de uma tarefa, **Nova subtarefa** (na aba Tarefas relacionadas) abre o mesmo formulário já com a tarefa pai, o projeto e a versão dela.

- **Projeto** e **Título** são obrigatórios. O projeto já vem preenchido: o do quadro (e, num quadro de sprint, a versão da sprint; vale também para o botão da barra lateral e o ⌘N enquanto o quadro está aberto) ou o projeto das sprints configurado em Configurações → Sprints e Início. Clique no campo e digite para procurar outro projeto.
- **Tipo** e **Prioridade** começam com o padrão do Redmine. Trocar o projeto limpa tipo, responsável e versão, que dependem do projeto.
- **Descrição** em Markdown, como no Redmine.
- **Campos personalizados do tipo** (no Redmine da empresa: Modulo, Solicitante, Categoria, Cliente…) aparecem abaixo da descrição, com os valores já usados no projeto como sugestão ao digitar. Os marcados com `*` estão preenchidos em todas as tarefas recentes desse tipo e são tratados como obrigatórios. A lista vem das tarefas recentes do projeto, então um valor novo de uma lista do Redmine pode ser recusado; nesse caso aparece a mensagem do Redmine. Numa **Nova subtarefa**, eles já vêm com os valores da tarefa pai.
- **Anexos**: clique em **Escolher arquivos**, arraste arquivos para a área tracejada ou cole uma imagem (⌘V, por exemplo uma captura de tela) em qualquer campo. Cada arquivo aparece como um cartão, igual aos da aba Anexos: miniatura das imagens e ícone do tipo para o resto. Clique numa imagem ou num arquivo de texto para ver maior (as setas passam entre eles); o ✕ tira o arquivo. Até 10 arquivos de até 20 MB cada (o Redmine pode ter um limite menor).
- **Responsável** funciona como no detalhe: digite para filtrar e clique no nome. **Versão**, **Início** e **Previsão** são opcionais.
- **Tarefa pai**: o número, com ou sem `#`. Ao sair do campo, o título dela aparece embaixo, para conferir.
- **Estimado**: as horas previstas, do mesmo jeito que no lançamento de horas (8, 1,5, 1:30, 1h30).
- A tarefa só é criada pelo botão **Criar tarefa** (o `Enter` no título não cria, para evitar criar por engano). Depois de criada, ela abre no detalhe.
- Se faltar algum campo obrigatório, aparece a mensagem do Redmine (ex.: "Categoria não pode ficar em branco") e nada é criado: preencha e clique de novo.

### Anexos

![Aba Anexos](images/issue-attachments.png)

A aba **Anexos** mostra cada arquivo da tarefa como um cartão com o nome, o tamanho, quem anexou e quando. Imagens aparecem em miniatura; os outros arquivos, com o ícone do tipo (texto ou código, PDF, documento, planilha, apresentação, vídeo, áudio, arquivo compactado).

Ao clicar num anexo:

- **Imagens** (PNG, JPG, GIF, WebP, SVG…) e **arquivos de texto** (`.txt`, `.log`, `.json`, `.csv`, `.md`, `.sql`, código…) abrem **dentro do app**. JSON aparece já indentado. Arquivos de texto muito grandes mostram só o começo.
- **Vídeos e áudios** (MP4, MOV, WebM, MP3, M4A…) até 100 MB **tocam dentro do app**. Se o formato ou o codec não tocar, a visualização avisa; use **Abrir no app do sistema**.
- **PDF, documentos, planilhas e apresentações**, e vídeos MKV/AVI, abrem no **app do sistema** (Preview, Word, Excel…).
- **Arquivos compactados** (`.zip`, `.rar`…), **programas** e outros tipos abrem **no Redmine**, no navegador.

![Visualizar anexo](images/attachment-preview.png)

Na visualização, as setas (`←` `→` ou os botões) passam pelos outros anexos que dá para ver no app, e os botões no topo abrem o arquivo no app do sistema ou no Redmine. `Esc` fecha.

**Imagens no meio do texto**: quando a descrição ou um comentário tem uma imagem anexada à tarefa (o print colado no Redmine), ela aparece como uma miniatura pequena no lugar, para não ocupar a tela; clique para ver maior, com as setas para os outros anexos. Um vídeo citado no texto aparece como etiqueta com o nome e toca ao clicar.

![Imagem na descrição](images/issue-inline-image.png)

Por segurança, o app nunca entrega ao sistema arquivos que podem executar algo ao abrir: programas (`.exe`, `.app`, `.dmg`…), scripts (`.bat`, `.js`, `.sh`, `.ps1`…), páginas (`.html`, `.svg`) e documentos do Office com macro (`.docm`, `.xlsm`, `.pptm`). Esses abrem no Redmine; os de texto ainda dá para ver dentro do app.

### Lançar horas

![Horas no detalhe da tarefa](images/time-issue.png)

A aba **Horas** do detalhe mostra o total lançado contra o estimado ("13 h de 16 h estimadas") e todos os lançamentos da tarefa. Os seus aparecem destacados, com os botões para editar e excluir.

![Lançar horas](images/time-dialog.png)

Em **Lançar horas**, informe:

- **Data**: hoje por padrão, com os atalhos **Hoje** e **Ontem**. Qualquer data é aceita.
- **Horas**: do jeito que for mais fácil, como `1,5`, `1:30`, `1h30` ou `90m`. Ao lado aparece como o app entendeu ("= 1,5 h").
- **Atividade**: o tipo de trabalho no Redmine (Desenvolvimento, Reunião…), que não é a tarefa. Vem marcada a última que você usou; se o Redmine tiver uma só, o campo nem aparece.
- **Comentário**: obrigatório, com o que foi feito.

### Cronômetro

**Iniciar cronômetro**, nas ações rápidas, começa a contar o tempo na tarefa. O cronômetro aparece na barra lateral, e no macOS também na barra de menus (⏱ 0:42).

- **Pausar e retomar** pela barra lateral ou pelo menu da bandeja.
- **Parar e lançar** abre o formulário com as horas contadas. Ao lançar, o cronômetro some. Se cancelar, ele fica pausado.
- **Descartar** (×) apaga o cronômetro sem lançar nada.
- Ele continua contando com a janela fechada e mesmo depois de fechar e abrir o app.
- Ele pausa sozinho quando o computador dorme ou a tela é bloqueada. Depois de 10 minutos sem uso do teclado e do mouse, pausa e não conta o tempo em que você ficou fora; a barra lateral avisa desde quando.
- Só existe um cronômetro por vez: começar em outra tarefa pede confirmação e descarta o anterior.

### Minhas horas

![Minhas horas](images/time-page.png)

**Minhas horas**, no menu lateral, mostra a sua semana:

- **Totais por dia** no topo, com o dia de hoje destacado.
- **Grade**: uma linha por tarefa e uma coluna por dia. Clique numa célula para lançar horas naquela tarefa e dia, ou no nome da tarefa para abrir o detalhe.
- **Lançamentos da semana**: a lista completa, com editar e excluir.
- **Lançar horas** em outra tarefa: digite o número dela no campo acima da grade.
- **Repetir semana passada** lança de novo, nesta semana, os lançamentos da semana anterior (mesma tarefa, dia da semana, horas, atividade e comentário), depois de confirmar quantos são. Use uma vez por semana: repetir de novo cria outra cópia.
- As setas mudam de semana e **Esta semana** volta para a atual. A semana começa no dia escolhido em Configurações → Agenda.

No **Início**, o indicador **Horas hoje** mostra quanto você lançou no dia e abre esta tela.

## 5. Sprints

![Tela Sprints](images/sprints.png)

O app lê as versões do projeto configurado (aba Planejamento do Redmine) e segue esta convenção:

| Nome da versão | O que é                                                 | Exemplo |
| -------------- | ------------------------------------------------------- | ------- |
| `X.Y`          | Sprint                                                  | 3.78    |
| `X.Y.Z`        | Correção na branch da qualidade (staging) da sprint X.Y | 3.77.1  |
| Outros nomes   | Agrupador (backlog etc.)                                | Backlog |

Cada sprint recebe uma fase:

| Fase                    | Quando                                                      |
| ----------------------- | ----------------------------------------------------------- |
| **Em desenvolvimento**  | Aberta, com o prazo dos devs mais próximo ainda não vencido |
| **Planejada**           | Aberta, com prazo dos devs mais adiante                     |
| **Em homologação**      | Aberta, prazo dos devs vencido, publicação no futuro        |
| **Publicação atrasada** | Aberta, com a data de publicação já passada                 |
| **Em produção**         | A última sprint fechada já publicada                        |
| **Correção**            | Versão `X.Y.Z` aberta                                       |

As datas vêm dos campos personalizados da versão (prazo dos devs e data de publicação), detectados automaticamente. Os cartões mostram quantas tarefas estão fechadas, abertas e quantas são suas. **Publicadas recentemente** lista as sprints já entregues.

![Tarefas da sprint](images/sprint-dialog.png)

Clique em um cartão para ver as tarefas da sprint agrupadas por status, filtrar por responsável ou só as suas, e **Criar quadro desta versão**.

## 6. Agenda

![Agenda, visão semanal](images/calendar.png)

A Agenda funciona como o Google Agenda, mas os compromissos ficam salvos só neste computador.

- **Visões**: **Dia**, **Semana**, **Mês** e **Lista**. **Hoje** volta para a data atual; as setas avançam e voltam.
- **Agendas** (à esquerda) liga e desliga as camadas:
  - **Meus compromissos**: os que você criou.
  - **Sprints (prazos e publicações)**: prazo dos devs e publicação de cada sprint.
  - **Prazos das minhas tarefas**: data de entrega das suas tarefas.
- **Buscar compromissos** filtra pelo título.
- O minicalendário marca com um ponto os dias que têm compromissos.

![Agenda, visão mensal](images/month.png)

### Criar um compromisso

- Clique em **Criar** (ou tecle `c`).
- Ou clique e arraste na grade da visão Dia/Semana para marcar o horário.
- Ou clique em um dia na linha **dia todo** para um compromisso de dia inteiro.

![Editor de compromisso](images/editor.png)

No editor:

- **Título**, data e horário (ou **Dia inteiro**).
- **Repetição**: não se repete, todos os dias, dias úteis, semanal, mensal (no dia N ou na N-ésima semana), anual ou **Personalizar…** (intervalo, dias da semana, término por data ou número de vezes).
- **Lembretes**: quantos quiser (na hora, 5 min, 10 min, 1 h, 1 dia, 1 semana antes ou personalizado).
- **Cor**, **local**, **descrição** e **vínculo com uma tarefa do Redmine** (`#1201`).
- `Ctrl`/`⌘` + `Enter` salva.

### Ver, duplicar e excluir

![Detalhes do compromisso](images/event.png)

Clique em um compromisso para ver os detalhes. Os ícones editam, duplicam e excluem. O link da tarefa vinculada abre o detalhe dela.

Ao editar ou excluir um compromisso que se repete, o app pergunta o alcance: **Este evento**, **Este e os seguintes** ou **Todos os eventos**.

### Lembretes

Os lembretes chegam como notificação do sistema, mesmo com a janela fechada (o app precisa estar na bandeja). Clicar na notificação abre o compromisso na Agenda. Se o computador estava suspenso, lembretes perdidos nos últimos 10 minutos ainda são entregues.

## 7. Notificações e monitores

![Tela Notificações](images/notifications.png)

Enquanto o app está aberto ou na bandeja, ele verifica o Redmine a cada intervalo (padrão: 60 s). O que ele observa é definido pelos **monitores**: cada monitor acompanha um conjunto de tarefas e tem as próprias opções de aviso.

| Monitor                            | O que acompanha                                                      |
| ---------------------------------- | -------------------------------------------------------------------- |
| **Minhas tarefas** (sempre existe) | Tarefas atribuídas a você, que você observa ou que você criou        |
| **Consulta salva**                 | O resultado de uma consulta do Redmine                               |
| **Filtro do Redmine (URL)**        | O resultado de qualquer filtro copiado da tela de tarefas do Redmine |
| **Quadro**                         | As tarefas de um quadro do app (ligado pelo editor do quadro)        |

Cada monitor escolhe sobre o que avisar:

| Aviso                 | Quando                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Nova tarefa**       | Criada por outra pessoa (só em Minhas tarefas)                                       |
| **Atribuída a mim**   | Alguém passou a tarefa para você                                                     |
| **Mudança de status** | Ex.: Em andamento → Em aprovação; em quadros, mostra as colunas                      |
| **Novo comentário**   | Nota adicionada por outra pessoa                                                     |
| **Menção**            | Comentário que cita o seu `@login`                                                   |
| **Outras alterações** | Prioridade, versão, datas, anexos… (desligado por padrão)                            |
| **Tarefa entrou**     | Passou a aparecer no resultado da consulta, filtro ou quadro                         |
| **Tarefa saiu**       | Deixou de aparecer; em Minhas tarefas, é a saída da sua fila (reatribuída, fechada…) |

Regras importantes:

- **Alterações feitas por você não geram notificação**, em nenhum monitor.
- Se dois monitores veem a mesma alteração, chega **uma** notificação só, com "via _nome do monitor_".
- Na primeira verificação (ou ao ligar um monitor) o app só "tira uma foto": nada do passado é notificado.
- Quando muitas novidades chegam de uma vez, o sistema mostra uma notificação resumida.

Na tela: **Não lidas** filtra, **Verificar agora** força uma verificação, e os ícones marcam tudo como lido e limpam o histórico. Clicar em um item **abre a tarefa no próprio app** (ou a lista, quando o aviso fala de várias). O mesmo vale para a notificação do sistema: o clique traz o app para a frente já com a tarefa aberta. O número de não lidas também aparece na barra lateral e no ícone da bandeja.

### Criar e editar monitores

![Monitores](images/monitors.png)

Em **Configurações → Notificações → Monitores**: o switch liga e desliga cada monitor, o lápis edita e a lixeira exclui. **Adicionar monitor** abre o editor:

![Editor de monitor](images/monitor-editor.png)

- **Nome** e **Origem das tarefas** (consulta salva, filtro por URL ou quadro).
- **Notificar quando**: os avisos que esse monitor manda.
- **Horário próprio** (opcional): só verifica esse monitor nos dias e horas escolhidos, além do horário geral.

## 8. Log

![Tela Log](images/log.png)

A tela **Log** (barra lateral → App) mostra o que o app fez:

- **Requisições** ao Redmine: horário, endereço, status, **tempo** e **tamanho** da resposta (e a tentativa, quando houve nova tentativa).
- Passos do **monitor**: verificação concluída (quantos monitores e notificações, em quanto tempo), monitor ignorado ou com erro, resultado grande demais para comparar.

Os indicadores no topo (requisições, erros, tempo médio e total transferido) consideram o que está filtrado. Use **Tudo / Requisições / Monitor / Erros** e a busca para achar algo; a tela se atualiza sozinha. **Apagar log** limpa o histórico.

O log fica no arquivo `logs/activity.log`, na pasta de dados do app, com até 5 MB (os registros mais antigos são descartados). A sua API key nunca aparece nele.

## 9. Configurações

As configurações ficam divididas em abas, na coluna à esquerda.

![Configurações: aba Geral](images/settings-general.png)

**Geral**

- **Conta**: o Redmine e o usuário conectados. **Desconectar** apaga a chave deste computador.
- **Idioma**: Português (Brasil), English (US) ou o idioma do sistema.
- **Sobre**: a versão instalada, o sistema e a pasta de dados; **Abrir pasta de dados** abre essa pasta no Finder/Explorer. **Copiar informações de suporte** copia um texto com versão, sistema, estado do monitor, notificações e erros recentes (sem a chave de API) para colar na conversa com quem vai ajudar.
- **Atualizações**: com um token do GitHub (veja [Atualizações automáticas](INSTALACAO.md#atualizações-automáticas)), o app procura versões novas 30 segundos depois de abrir e depois no intervalo escolhido em **Procurar**: a cada 1 hora, 4 horas, 12 horas, uma vez por dia (padrão) ou uma vez por semana. Quando sai uma, aparece um aviso na barra lateral e, aqui, o botão **Baixar versão…** com as novidades. Depois de baixar: no Windows, **Reiniciar e atualizar**; no Mac, **Abrir instalador** (o app fecha para você arrastar a versão nova para Aplicativos). **Verificar agora** força a consulta; o switch **Procurar versões novas automaticamente** desliga a verificação. Sem token, o app funciona normalmente e só não avisa sobre versões novas.

### Aparência

![Aparência, tema escuro](images/appearance.png)

- **Tema**: **Do sistema** (segue o claro/escuro do computador), **Claro** ou **Escuro**. Menus, barra de título e barras de rolagem acompanham.
- **Paleta do tema claro**: Padrão ou Papel (tons mais quentes). **Paleta do tema escuro**: Grafite, Meia-noite (azulado) ou Preto (bom para telas OLED). Cada tema guarda a sua paleta; com "Do sistema", vale a do tema do momento.
- **Cor de destaque**: usada em botões, links, seleção, dia de hoje e contadores. Escolha uma das 8 cores, clique no **+** para qualquer cor, ou digite o código (ex.: `#2563eb`). O texto sobre a cor fica preto ou branco, o que for mais legível; no tema escuro a cor fica um pouco mais clara.
- **Tamanho da interface**: 90%, 100%, 110% ou 125% — textos e espaçamentos de todas as telas.
- **Reduzir animações**: desliga transições e ícones girando.
- **Prévia** mostra os componentes com as escolhas atuais; **Restaurar padrão** volta ao visual original.

![Aparência, tema claro com destaque azul](images/appearance-light.png)

#### Cores das tarefas

![Cores das tarefas](images/issue-style.png)

Ainda na aba **Aparência**, a seção **Cores das tarefas** ajusta o que o app deduz pelo nome:

- **Cor dos status**: cada status do Redmine aparece com a cor atual. Em "Automático" o app escolhe pelo nome; escolha outra família (Nova, Em andamento, Em aprovação/revisão, Em teste, Em pausa/bloqueada, Concluída, Rejeitada/cancelada) para os status que ficaram com a cor errada.
- **Nível das prioridades**: diga qual prioridade é Urgente (vermelho), Alta (amarelo), Normal (sem destaque) ou Baixa (cinza). Urgente e Alta entram nos contadores de prioridade alta do Início e dos quadros.
- **Destacar previsão a partir de**: quantos dias antes a previsão fica amarela nos cards (padrão 3; 0 = só no dia e vencidas).
- **Voltar ao automático** apaga as escolhas de status e prioridades.

A prévia ao lado de cada item muda na hora, e a escolha vale em todo o app.

**Notificações**

![Configurações: aba Notificações](images/settings.png)

- **Monitoramento**:
  - **Notificações do sistema** mostra se a permissão está ativa; **Verificar** confere de novo e **Enviar notificação de teste** testa a entrega.
  - **Intervalo de verificação** (mínimo 30 s), **Som nas notificações** e **Abrir ao iniciar o computador**.
  - **Guardar lembretes da agenda no histórico**: a notificação do sistema aparece de qualquer forma.
- **Monitores**: veja [Criar e editar monitores](#criar-e-editar-monitores).
- **Horário**: monitorar só em dias e horas definidos. Fora da janela o monitor pausa e, ao voltar, as novidades chegam agrupadas.

**Agenda**

![Configurações: aba Agenda](images/settings3.png)

- Dia em que a semana começa, duração padrão, lembretes padrão (com horário e de dia inteiro) e horário dos lembretes de dia inteiro.

**Sprints e Início**

![Configurações: aba Sprints e Início](images/settings2.png)

- **Sprints**: o projeto cujas versões viram sprints, os campos de prazo dos devs e de publicação, e os padrões de nome (regex) de sprint e correção.
- **Início**: após quantos dias sem movimentação uma tarefa é considerada parada.

## 10. Atalhos e perguntas frequentes

### Atalhos gerais

| Tecla               | Ação                       |
| ------------------- | -------------------------- |
| `⌘K` / `Ctrl+K`     | Abrir a busca rápida       |
| `↑` / `↓` e `Enter` | Escolher e abrir, na busca |
| `Esc`               | Fechar a busca             |
| `⌘N` / `Ctrl+N`     | Nova tarefa                |
| `⌘↵` / `Ctrl+Enter` | Salvar a descrição editada |

### Atalhos da Agenda

| Tecla                 | Ação                             |
| --------------------- | -------------------------------- |
| `c`                   | Criar compromisso                |
| `t`                   | Ir para hoje                     |
| `d` / `w` / `m` / `a` | Visão Dia / Semana / Mês / Lista |
| `n` / `p`             | Próximo / anterior               |
| `Ctrl`/`⌘` + `Enter`  | Salvar no editor                 |
| `Esc`                 | Fechar janelas e diálogos        |

### Perguntas frequentes

**As notificações não aparecem.**
Em **Configurações → Notificações**, use **Enviar notificação de teste** e responda se ela apareceu: o app mostra onde ligar as notificações no sistema. Confira também o modo Foco (macOS) ou o Não incomodar (Windows).

**Arrastei um card e ele voltou para a coluna de origem.**
O Redmine recusou a mudança (fluxo de trabalho ou campo obrigatório). A mensagem de erro explica o motivo; ajuste pela tela do Redmine se precisar preencher algo.

**Meus compromissos aparecem em outro computador?**
Não. A agenda fica em `calendar.json`, na pasta de dados do app, só neste computador.

**Onde ficam os dados do app?**
macOS: `~/Library/Application Support/Refined Redmine/`. Windows: `%APPDATA%\Refined Redmine\`. Os arquivos são `config.json` (preferências, monitores e chave criptografada), `state.json` (monitor e notificações), `calendar.json` (agenda) e `logs/activity.log` (log).

**Criei uma consulta no Redmine e ela não aparece na lista.**
Clique no botão de recarregar ao lado da lista de consultas (no editor do quadro ou do monitor). Aparecem as consultas públicas e as suas.

**Quero ser avisado de tarefas que não são minhas.**
Crie um monitor com uma consulta salva ou um filtro por URL (**Configurações → Notificações → Adicionar monitor**), ou ligue **Notificar sobre este quadro** no editor do quadro.

**O app está lento para atualizar ou deu erro de conexão.**
Veja a tela **Log**: ela mostra cada requisição com o tempo de resposta e o erro, se houve.

**As sprints não aparecem ou estão sem datas.**
Em **Configurações → Sprints e Início**, escolha o projeto certo e confira os campos de prazo dos devs e de publicação.

**Como fico sabendo de uma versão nova?**
Com as atualizações automáticas ligadas (Configurações → Geral → Atualizações), o app avisa na barra lateral. Depois de atualizar, ele mostra uma vez a janela **O que há de novo**.

**O app pediu para conectar de novo.**
A chave salva não pôde ser lida neste computador (por exemplo, depois de instalar a versão nova, trocar de computador ou redefinir o Keychain). Informe a URL e a chave outra vez; quadros e preferências continuam lá.

**Fechei a janela. O app parou?**
Não, ele segue na bandeja. Para encerrar, use **Sair** no menu da bandeja.

**O cronômetro parou sozinho.**
Ele pausa quando o computador dorme, quando a tela é bloqueada ou depois de 10 minutos sem uso, e não conta esse tempo. É só clicar em retomar na barra lateral.

**Lancei horas e o Redmine recusou.**
A mensagem diz o motivo, normalmente falta de permissão para lançar horas no projeto ou uma tarefa fechada para lançamentos. Peça a permissão ao administrador do Redmine.

**Mudei a versão (ou outro campo) da tarefa e apareceu "O Redmine não aplicou".**
O Redmine aceitou o salvamento, mas ignorou aquele campo: o fluxo de trabalho deixa o campo só para leitura no status atual, ou falta permissão. O detalhe mostra o valor que ficou no Redmine; mude o status ou peça para quem tem permissão.

**A busca não acha uma tarefa pelo número.**
A busca só mostra tarefas que a sua conta do Redmine pode ver. Se a tarefa for de um projeto em que você não está, ela não aparece.
