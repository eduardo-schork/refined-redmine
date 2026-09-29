# Refined Redmine — Manual do usuário

O Refined Redmine é um app de desktop (macOS; Windows em breve) que fica por cima do Redmine da empresa. Ele junta um painel com o seu dia, quadros kanban que mudam o status no Redmine ao arrastar, uma visão das sprints, uma agenda com lembretes e notificações do sistema operacional.

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

A versão 0.1.0 é só para **macOS** (o Windows ainda não foi testado).

1. Escolha o arquivo do seu Mac (menu Apple → **Sobre este Mac**): chip **Apple** (M1, M2…) → `Refined Redmine-0.1.0-arm64.dmg`; **Intel** → `Refined Redmine-0.1.0.dmg`.
2. Abra o `.dmg` e arraste o **Refined Redmine** para **Aplicativos**.
3. Na primeira abertura o macOS avisa que o desenvolvedor não foi verificado (o app ainda não tem assinatura da Apple). Vá em **Ajustes do Sistema → Privacidade e Segurança** e clique em **Abrir Mesmo Assim**. Outra opção é rodar uma vez no Terminal:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Refined Redmine.app"
   ```

4. Se o macOS pedir a senha para o app usar o Keychain ("Refined Redmine Safe Storage"), clique em **Sempre permitir**: é lá que a chave do Redmine fica guardada.

Versões novas são instaladas do mesmo jeito, por cima da anterior; quadros, agenda e preferências são mantidos.

### Conectar ao Redmine

![Tela de conexão](images/onboarding.png)

1. Em **URL do Redmine**, informe o endereço que você usa no navegador (ex.: `https://redmine.suaempresa.com.br`).
2. Em **Chave de acesso à API**, cole a sua chave. No Redmine: **Minha conta → Chave de acesso à API → Mostrar**.
3. Clique em **Conectar**.

A chave é guardada criptografada pelo sistema (Keychain no macOS, DPAPI no Windows) e nunca sai do seu computador, a não ser nas chamadas ao próprio Redmine.

### Permitir notificações

Sempre que o app abre sem permissão para notificações, aparece a janela **Ativar notificações**. Clique em **Solicitar permissão** e confirme o aviso do sistema. Se as notificações estiverem bloqueadas, use **Abrir ajustes de notificações**: no macOS, em **Ajustes do Sistema → Notificações → Refined Redmine**, ative **Permitir notificações** com o estilo **Alertas** ou **Faixas**. Depois, use **Configurações → Notificações → Enviar notificação de teste** para confirmar.

> **Importante no app instalado**: confira em **Ajustes do Sistema → Notificações → Refined Redmine** se **Permitir notificações** está ligado. O macOS pode deixar desligado na instalação, e o app não consegue perceber isso — a tela de Configurações pode mostrar "Permitidas" mesmo assim. Se a notificação de teste não aparecer, é aí que se resolve.

### Bandeja do sistema

Fechar a janela não encerra o app: ele continua na bandeja (barra de menus no macOS), verificando o Redmine e disparando lembretes. Pelo ícone da bandeja você abre o app, a Agenda ou as Notificações, força uma verificação (**Verificar agora**) ou sai (**Sair**).

## 2. Início

![Tela Início](images/home.png)

O painel resume o seu dia:

- **Indicadores**: tarefas na sua fila, paradas, atrasadas e notificações não lidas.
- **Sprints**: cartões das sprints ativas com fase, prazo dos devs, data de publicação e progresso. **Ver sprints** abre a tela completa.
- **Agenda de hoje**: os compromissos do dia. **Abrir agenda** leva à Agenda.
- **Minha fila**: suas tarefas abertas, com contagem por status.
- **Paradas**: tarefas sem movimentação há vários dias (padrão: 5, ajustável em Configurações) ou em pausa/aguardando.
- **Prazos**: tarefas vencidas ou que vencem nos próximos 7 dias.

Clique em qualquer tarefa para abrir o [detalhe da tarefa](#4-detalhe-da-tarefa).

## 3. Quadros kanban

![Quadro "Minha fila"](images/board.png)

Os quadros ficam na barra lateral, em **Quadros**. Cada coluna agrupa um ou mais status do Redmine.

- **Arrastar um card para outra coluna muda o status no Redmine.** O app só permite soltar onde a transição é aceita pelo fluxo de trabalho da tarefa.
- **Buscar** filtra por título, `#id` ou projeto.
- **Todos os responsáveis** filtra os cards por pessoa.
- Os ícones no canto superior direito atualizam, editam e excluem o quadro.

Cada card mostra número, tipo, título, responsável, projeto, versão, data de entrega (em vermelho quando vencida) e o percentual concluído.

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

Clicar em uma tarefa, em qualquer tela, abre o detalhe sem sair do app.

- **Descrição**, com formatação (listas, tabelas, negrito, links).
- **Anexos**, **Relações** e **Histórico** (comentários e mudanças de campos).
- **Status**: troque direto pelo seletor; só aparecem os status permitidos para a tarefa.
- **Adicionar comentário**: aceita Markdown e é publicado no Redmine.
- Na lateral: prioridade, responsável, autor, versão, datas, horas estimadas e gastas, % concluído, campos personalizados e observadores.
- **Abrir no Redmine** abre a tarefa no navegador.

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

Na tela: **Não lidas** filtra, **Verificar agora** força uma verificação, e os ícones marcam tudo como lido e limpam o histórico. Clicar em um item abre a tarefa (ou a lista, quando o aviso fala de várias). O número de não lidas também aparece na barra lateral e no ícone da bandeja.

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
- **Sobre**: a versão instalada, o sistema e a pasta de dados; **Abrir pasta de dados** abre essa pasta no Finder/Explorer. Informe a versão ao reportar um problema.

### Aparência

![Aparência, tema escuro](images/appearance.png)

- **Tema**: **Do sistema** (segue o claro/escuro do computador), **Claro** ou **Escuro**. Menus, barra de título e barras de rolagem acompanham.
- **Paleta do tema claro**: Padrão ou Papel (tons mais quentes). **Paleta do tema escuro**: Grafite, Meia-noite (azulado) ou Preto (bom para telas OLED). Cada tema guarda a sua paleta; com "Do sistema", vale a do tema do momento.
- **Cor de destaque**: usada em botões, links, seleção, dia de hoje e contadores. Escolha uma das 8 cores, clique no **+** para qualquer cor, ou digite o código (ex.: `#2563eb`). O texto sobre a cor fica preto ou branco, o que for mais legível; no tema escuro a cor fica um pouco mais clara.
- **Tamanho da interface**: 90%, 100%, 110% ou 125% — textos e espaçamentos de todas as telas.
- **Reduzir animações**: desliga transições e ícones girando.
- **Prévia** mostra os componentes com as escolhas atuais; **Restaurar padrão** volta ao visual original.

![Aparência, tema claro com destaque azul](images/appearance-light.png)

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

**As notificações não aparecem no macOS.**
Confira em **Ajustes do Sistema → Notificações → Refined Redmine** se **Permitir notificações** está ligado (no app instalado ele pode vir desligado, mesmo com o app mostrando "Permitidas") e se o modo Foco não está ativo. Depois use **Enviar notificação de teste**.

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

**O app pediu para conectar de novo.**
A chave salva não pôde ser lida neste computador (por exemplo, depois de instalar a versão nova, trocar de computador ou redefinir o Keychain). Informe a URL e a chave outra vez; quadros e preferências continuam lá.

**Fechei a janela. O app parou?**
Não, ele segue na bandeja. Para encerrar, use **Sair** no menu da bandeja.
