# Instalar o Refined Redmine

Guia rápido para quem vai usar o app. Leva uns 5 minutos. Dúvidas sobre o uso estão no [manual](MANUAL.md).

Antes de começar, tenha à mão a sua **chave de API do Redmine**: no Redmine, **Minha conta → Chave de acesso à API → Mostrar**.

**Baixe o instalador** da última versão em <https://github.com/eduardo-schork/refined-redmine/releases/latest>, na lista **Assets**
(não precisa de conta no GitHub). O nome do arquivo de cada sistema está nos passos abaixo.

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
- **Versão nova:** o próprio app avisa e instala ([atualizações automáticas](#atualizações-automáticas), ligadas por padrão). Se preferir, baixe o instalador da página de Releases e instale por cima, do mesmo jeito. Quadros, monitores, agenda e preferências são mantidos. Se o app pedir para conectar de novo, é só informar a URL e a chave outra vez.

## Atualizações automáticas

Não precisa configurar nada: o app procura versões novas nas Releases públicas do GitHub (30 s depois de abrir e depois no intervalo escolhido em **Configurações → Geral → Atualizações**), baixa o instalador, confere que o arquivo é o publicado (SHA-256) e, no Windows, atualiza e reabre sozinho. No Mac, ele abre o `.dmg` e fecha; você arrasta o app para Aplicativos, substitui e abre de novo.

**Token do GitHub (opcional).** Sem conta, o GitHub permite 60 consultas por hora por rede. Num escritório com muita gente atrás do mesmo endereço, se aparecer "O GitHub limitou as consultas", crie um token **fine-grained** sem nenhuma permissão em <https://github.com/settings/personal-access-tokens/new> e cole em **Configurações → Geral → Atualizações** (**Testar** e **Salvar token**). O app guarda o token criptografado pelo sistema e ele nunca aparece no log nem nas informações de suporte.

Versões até a 0.9.0 só atualizavam com um token com acesso ao repositório (que era privado). Quem está nelas recebe a próxima versão normalmente se já salvou um token; sem token, instale a próxima versão manualmente uma vez (página de Releases do repositório).

## Deu problema?

Abra **Configurações → Geral → Sobre → Copiar informações de suporte** e cole o texto na conversa com quem está ajudando. Ele traz a versão, o sistema, o estado do monitor e os erros recentes; **a sua chave de API nunca vai junto**.
