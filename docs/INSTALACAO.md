# Instalar o Refined Redmine

Guia rápido para quem vai usar o app. Leva uns 5 minutos. Dúvidas sobre o uso estão no [manual](MANUAL.md).

Antes de começar, tenha à mão a sua **chave de API do Redmine**: no Redmine, **Minha conta → Chave de acesso à API → Mostrar**.

## macOS

1. **Escolha o arquivo** do seu Mac (menu Apple → **Sobre este Mac**):
   - chip **Apple** (M1, M2, M3…) → `refined-redmine-<versão>-mac-arm64.dmg`
   - **Intel** → `refined-redmine-<versão>-mac-x64.dmg`
2. Abra o `.dmg` e **arraste o Refined Redmine para Aplicativos**.
3. **Primeira abertura.** O app ainda não tem assinatura da Apple, então o macOS avisa que o desenvolvedor não foi verificado e não abre. Para liberar, escolha um dos caminhos:
   - **Ajustes do Sistema → Privacidade e Segurança**, role até o aviso do Refined Redmine e clique em **Abrir Mesmo Assim**; ou
   - no Terminal, rode uma vez:

     ```bash
     xattr -dr com.apple.quarantine "/Applications/Refined Redmine.app"
     ```

4. **Keychain.** Se o macOS pedir a senha para o app usar o Keychain ("Refined Redmine Safe Storage"), digite a senha do Mac e clique em **Sempre permitir**. É lá que a chave do Redmine fica guardada.
5. **Conecte** com a URL do Redmine e a sua chave de API.
6. **Notificações.** O app abre a janela **Confirmar notificações**: clique em **Enviar notificação de teste** e responda se ela apareceu.
   - Se **não apareceu**: em **Ajustes do Sistema → Notificações → Refined Redmine**, ligue **Permitir notificações** (estilo **Alertas** ou **Faixas**). O macOS costuma deixar isso desligado na instalação. Volte ao app, clique em **Testar de novo** e confirme.
   - Confira também se o modo **Foco** não está ativo.

## Windows

1. Rode `refined-redmine-<versão>-windows-setup.exe`.
2. O Windows pode mostrar **"O Windows protegeu o computador"** (SmartScreen), porque o instalador ainda não tem assinatura digital. Clique em **Mais informações → Executar assim mesmo**.
3. Escolha a pasta de instalação (ou deixe a sugerida) e conclua. O app ganha um atalho no menu Iniciar.
4. **Conecte** com a URL do Redmine e a sua chave de API.
5. **Notificações.** Na janela **Confirmar notificações**, clique em **Enviar notificação de teste** e responda se ela apareceu. Se não apareceu: **Configurações → Sistema → Notificações**, ligue as notificações do **Refined Redmine** e confira o **Não incomodar / Assistente de foco**; depois **Testar de novo**.

## Depois de instalar

- Fechar a janela **não** encerra o app: ele fica na bandeja (barra de menus no Mac, perto do relógio no Windows) verificando o Redmine. Para encerrar, use **Sair** no menu do ícone.
- Quer que ele abra sozinho? **Configurações → Notificações → Abrir ao iniciar o computador**.
- **Versão nova:** com as [atualizações automáticas](#atualizações-automáticas) ligadas, o próprio app avisa e instala. Sem elas, instale por cima, do mesmo jeito. Quadros, monitores, agenda e preferências são mantidos. Se o app pedir para conectar de novo, é só informar a URL e a chave outra vez.

## Atualizações automáticas

Opcional. Com isso, o app avisa quando sai versão nova, baixa o instalador e, no Windows, atualiza e reabre sozinho. No Mac, ele abre o `.dmg` e fecha; você arrasta o app para Aplicativos, substitui e abre de novo.

1. **Peça acesso** ao repositório para quem mantém o app. Você recebe um convite do GitHub por e-mail: aceite.
2. **Crie um token** no GitHub. De preferência um **fine-grained** (começa com `github_pat_`), que só enxerga este repositório e só pode ler:
   - abra <https://github.com/settings/personal-access-tokens/new>;
   - em **Repository access**, escolha **Only select repositories** e selecione `refined-redmine`;
   - em **Permissions → Repository permissions**, deixe **Contents: Read-only** (o resto fica sem acesso);
   - escolha uma validade (quando expirar, gere outro e cole no app de novo).

   Se o `refined-redmine` não aparecer na lista, o GitHub não deixa usar token fine-grained para esse repositório na sua conta. Crie então um token **clássico** em <https://github.com/settings/tokens/new?scopes=repo&description=Refined%20Redmine>, só com o escopo **`repo`**.

3. No app: **Configurações → Geral → Atualizações**, cole o token, clique em **Testar** e depois em **Salvar token**.

Cuidados: trate o token como uma senha (o clássico dá acesso a todos os repositórios privados da sua conta no GitHub); o app o guarda criptografado pelo sistema, usa só para consultar e baixar as versões, e ele nunca aparece no log nem nas informações de suporte. Se desconfiar que vazou, apague-o no GitHub (a mesma página dos tokens) e crie outro.

A primeira versão com atualizações é a 0.2.0: quem está na 0.1.0 instala a 0.2.0 manualmente uma vez.

## Deu problema?

Abra **Configurações → Geral → Sobre → Copiar informações de suporte** e cole o texto na conversa com quem está ajudando. Ele traz a versão, o sistema, o estado do monitor e os erros recentes; **a sua chave de API nunca vai junto**.
