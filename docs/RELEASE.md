# Publicar uma versão

As versões são publicadas como **Releases** do repositório público `eduardo-schork/refined-redmine`. Os apps encontram a versão nova sozinhos, sem token (30 s depois de abrir e depois no intervalo escolhido em Configurações → Geral → Atualizações). A publicação é automática pelo GitHub Actions a cada push no `master` com commit `feat:` ou `fix:`.

## Branches

| Branch    | Para quê                                                                                                      | Publica versão?                       |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `develop` | onde o trabalho do dia a dia vai (commits e push)                                                             | não; só roda a verificação (`ci.yml`) |
| `master`  | o que está publicado; recebe **merge da `develop`** (de preferência por pull request) ou **correção urgente** | sim, quando chega `feat:`/`fix:`      |

- **O commit de release** (`chore: release x.y.z`) é feito pela Action no `master`, e **a própria Action traz o `master` de volta para a `develop`** (job `sync-develop`): a `develop` fica com o número novo e o CHANGELOG já renomeado. No computador, basta um `git pull` na `develop`.
- **Correção urgente** direto no `master` (`fix: …`): vira versão, então a Action também a leva para a `develop`.
- **Se der conflito** (geralmente no `CHANGELOG.md`, quando a `develop` ganhou commits durante o build), a Action **não envia nada**, o job `sync-develop` fica vermelho com as instruções no resumo e o GitHub avisa por e-mail. A versão já foi publicada; só falta fazer à mão: `git checkout develop && git merge master`, resolver e enviar.
- Push no `master` só com `docs:`/`chore:` não gera versão nem sincroniza: traga para a `develop` com `git merge master` quando precisar.

### Proteger o `master` (uma vez)

Em **Settings → Rules → Rulesets → New branch ruleset**:

- **Target branches**: `master` (Add target → Include by pattern → `master`).
- **Rules**: **Restrict deletions**, **Block force pushes** e **Require a pull request before merging**. Opcional: **Require status checks to pass**, com o check `check` (do `ci.yml`), depois que ele tiver rodado uma vez.
- **Bypass list → Add bypass → Repository admin → Always allow.** Sem isso, o commit de release que a Action faz com o seu token e as suas correções urgentes direto no `master` seriam bloqueados. Colaboradores (sem papel de admin) continuam precisando de pull request.

## Como uma versão sai (automático)

Todo push ou merge no `master` passa pelo GitHub Actions (`.github/workflows/release.yml`):

| Push no `master` com…                              | O que acontece                                      |
| -------------------------------------------------- | --------------------------------------------------- |
| pelo menos um commit `feat:` desde a última tag    | versão **minor** nova (0.5.0 → 0.6.0)               |
| só `fix:` (além de `docs:`, `chore:`…)             | versão **patch** nova (0.5.0 → 0.5.1)               |
| `feat!:` / `fix!:` (mudança que quebra algo)       | minor enquanto o app for 0.x; major a partir do 1.0 |
| só `docs:`, `chore:`, `refactor:`, `test:`, `ci:`… | nada: só a verificação (`ci.yml`)                   |

Quando há versão nova, a Action:

1. calcula o número a partir dos commits desde a última tag (`scripts/ci/release-plan.mjs plan`);
2. roda `npm run check`;
3. troca `## Próxima versão` do `CHANGELOG.md` pelo número, atualiza `package.json` e `package-lock.json` e gera os instaladores: os dois `.dmg` num Mac do GitHub e o `.exe` num Windows do GitHub;
4. faz o commit `chore: release <versão>`, cria a tag `v<versão>` e envia os dois juntos (`--atomic`: se o `master` mudou no meio, nada é enviado e nada é publicado);
5. cria a Release com o texto da seção do CHANGELOG, envia os 3 instaladores e **publica** (`scripts/release.mjs`);
6. leva o `master` para a `develop` (avança a `develop` quando ela não tem nada novo; se tiver, faz o commit `chore: merge master into develop after vX.Y.Z`; com conflito, não envia nada e avisa).

Os apps com token veem a versão na próxima verificação (ou em **Verificar agora**).

### O que você precisa fazer a cada versão

- Escrever as notas numa seção `## Próxima versão` no topo do `CHANGELOG.md`, com um item `- …` por novidade (opcional: `## Próxima versão — resumo curto`, que vira o título da Release). **Sem essa seção, com itens, a Action para com erro antes de gerar qualquer instalador.**
- Usar os prefixos nos commits: `feat:` para funcionalidade nova, `fix:` para correção, e `docs:`, `chore:`, `refactor:`, `test:` ou `ci:` para o resto.
- Não mexer no número da versão no `package.json`: a Action faz isso.

## Uma vez só: o token e o environment

A Release precisa sair no **seu** nome: os apps só aceitam versões e instaladores publicados pela conta `eduardo-schork` (`TRUSTED_PUBLISHER`). Uma Release criada com o token padrão das Actions sairia como `github-actions[bot]`, e todos os apps a ignorariam.

**O token nunca vai para o código nem para arquivo algum do repositório.** Ele fica nos Secrets do GitHub, cifrado. Ninguém consegue lê-lo de volta pela tela, e nos logs ele aparece como `***`.

1. **Criar o token** em <https://github.com/settings/personal-access-tokens/new>:
   - tipo **fine-grained**, com **validade** (ex.: 90 dias; o GitHub avisa antes de vencer);
   - **Repository access → Only select repositories → `refined-redmine`**;
   - **Permissions → Repository → Contents: Read and write** (e nada mais).
2. **Criar o environment**: no repositório, **Settings → Environments → New environment**, nome `release`.
   - **Deployment branches and tags → Selected branches and tags → Add rule → `master`.** Assim o segredo só é liberado para execuções no `master`: workflows de pull request, forks e outras branches não o recebem.
   - Opcional: **Required reviewers → você**. Cada versão espera o seu clique em "Approve" no GitHub antes de publicar. Hoje o fluxo está sem essa trava (publica direto).
3. **Guardar o token**: dentro do environment `release`, **Environment secrets → Add secret**, nome `RELEASE_TOKEN`, valor = o token. Use o secret **do environment**, não o do repositório.
4. **Settings → Actions → General**: deixe as Actions ligadas. "Workflow permissions" pode ficar em **Read** (os workflows pedem só leitura; quem publica é o seu token).

Só os jobs `publish` e `sync-develop` usam o `RELEASE_TOKEN`. Os jobs de verificação e de build, que rodam `npm ci` com código de terceiros, não o recebem; o `sync-develop` só roda `git`. Se um dia a `develop` ganhar um ruleset, coloque **Repository admin** na bypass list, como no `master`, senão a Action não consegue enviar.

**Trocar ou revogar**: gere um token novo e substitua o valor de `RELEASE_TOKEN` no environment. Para cortar na hora, revogue o token em <https://github.com/settings/personal-access-tokens>.

**Custo**: nenhum. Em repositório público, as Actions nos runners padrão (Linux, macOS e Windows) são gratuitas e sem limite de minutos. (Enquanto o repositório era privado, cada versão gastava uns 75 dos 2.000 minutos mensais do plano Free.)

## Publicar à mão (plano B)

Se a Action estiver fora do ar, o caminho manual continua funcionando. O `package.json` e o `CHANGELOG.md` precisam já estar na versão nova (`node scripts/ci/release-plan.mjs apply <versão>` faz isso), com commit e push:

```bash
nvm use
npm run dist:mac
npm run dist:win
GITHUB_TOKEN=seu_token npm run release -- --skip-build
```

`--draft` deixa a Release como rascunho; `--allow-dirty` pula a conferência do git. O token de publicação precisa de **Contents: Read and write**.

## Os arquivos de cada versão

| Arquivo                                      | Para               |
| -------------------------------------------- | ------------------ |
| `refined-redmine-<versão>-mac-arm64.dmg`     | Mac com chip Apple |
| `refined-redmine-<versão>-mac-x64.dmg`       | Mac Intel          |
| `refined-redmine-<versão>-windows-setup.exe` | Windows 64 bits    |

O app escolhe o instalador pelo final do nome, então esses nomes não podem mudar (`electron-builder.yml` → `artifactName`; `src/domain/update/release.ts`).

## Colaboradores e acesso

- **Atualizações não dependem de acesso**: o repositório é público, então todos os apps encontram e baixam as versões sem token. Não é preciso convidar ninguém para receber versões.
- **Colaborador serve só para mexer no código** (GitHub → **Settings → Collaborators → Add people**). Num repositório de conta pessoal, colaborador tem permissão de escrita (não existe "só leitura"); o ruleset do `master` exige pull request de quem não é admin.
- **Segurança:** os apps só aceitam Releases publicadas pela sua conta (`eduardo-schork`) e instaladores enviados por ela. Se um colaborador publicar uma Release, os apps a ignoram com um aviso. Se um dia outra pessoa for publicar, é preciso mudar `TRUSTED_PUBLISHER` (`src/infra/github/github-releases.ts`) e publicar uma versão com isso antes.

## De privado para público (0.9.0 → 0.10.0)

Até a 0.9.0 o repositório era privado e o app só procurava versões com um token do GitHub com acesso a ele. A 0.10.0 é a primeira publicada no repositório público:

- quem está na 0.9.0 **com token salvo** recebe a 0.10.0 pelo app, normalmente (token fine-grained sempre consegue ler repositório público);
- quem está na 0.9.0 **sem token** não procura versões: instala a 0.10.0 uma vez pela [página de Releases](https://github.com/eduardo-schork/refined-redmine/releases/latest), por cima. Daí em diante as versões chegam pelo app, sem token.

## Depois do primeiro build com os "fuses"

A 0.2.0 é a primeira versão com os _fuses_ do Electron ligados (`electronFuses` no `electron-builder.yml`). Antes de publicar, abra o app gerado (Mac e, se possível, Windows) e confira que ele inicia e conecta normalmente.

## Primeira vez (0.1.0 → 0.2.0)

A 0.1.0 não sabe se atualizar. Quem está nela instala a 0.2.0 manualmente, por cima; daí em diante as versões chegam pelo app.
