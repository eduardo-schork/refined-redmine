# Publicar uma versão

As versões são publicadas como **Releases** do repositório privado `eduardo-schork/refined-redmine`. Os apps que têm um token do GitHub com acesso ao repositório encontram a versão nova sozinhos (30 s depois de abrir e depois no intervalo escolhido em Configurações → Geral → Atualizações). A publicação é automática pelo GitHub Actions a cada push no `master` com commit `feat:` ou `fix:`.

## Branches

| Branch    | Para quê                                                                                                      | Publica versão?                       |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `develop` | onde o trabalho do dia a dia vai (commits e push)                                                             | não; só roda a verificação (`ci.yml`) |
| `master`  | o que está publicado; recebe **merge da `develop`** (de preferência por pull request) ou **correção urgente** | sim, quando chega `feat:`/`fix:`      |

- **Correção urgente** direto no `master` (`fix: …`): depois de publicada, traga para a `develop` com `git checkout develop && git merge master`, para as duas não divergirem.
- **O commit de release** (`chore: release x.y.z`) é feito pela Action no `master`. Depois de cada versão, atualize a `develop` com o `master` (`git merge master`), para ela ter o número novo e o CHANGELOG já renomeado.

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
5. cria a Release com o texto da seção do CHANGELOG, envia os 3 instaladores e **publica** (`scripts/release.mjs`).

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

Só o job `publish` usa o `RELEASE_TOKEN`. Os jobs de verificação e de build, que rodam `npm ci` com código de terceiros, não o recebem.

**Trocar ou revogar**: gere um token novo e substitua o valor de `RELEASE_TOKEN` no environment. Para cortar na hora, revogue o token em <https://github.com/settings/personal-access-tokens>.

**Custo**: repositório privado no plano Free tem 2.000 minutos de Actions por mês; minuto de macOS conta 10×, de Windows 2×. Uma versão gasta em torno de 75 minutos contados.

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

## Dar ou tirar o acesso de alguém às atualizações

- **Dar**: GitHub → repositório → **Settings → Collaborators → Add people**. Num repositório de conta pessoal, colaborador tem permissão de escrita (não existe "só leitura"). A pessoa aceita o convite, cria o próprio token (fine-grained só de leitura ou, se o GitHub não deixar escolher o repositório, clássico com escopo `repo`) e cola no app (**Configurações → Geral → Atualizações**). Passo a passo para ela em [INSTALACAO.md](INSTALACAO.md#atualizações-automáticas).
- **Segurança:** os apps só aceitam Releases publicadas pela sua conta (`eduardo-schork`) e instaladores enviados por ela. Se um colaborador publicar uma Release, os apps a ignoram com um aviso. Se um dia outra pessoa for publicar, ajuste `TRUSTED_PUBLISHER` em `src/infra/github/github-releases.ts`.
- **Tirar**: remova a pessoa dos colaboradores. O app dela deixa de ver versões novas na próxima verificação; o resto continua funcionando.

## Depois do primeiro build com os "fuses"

A 0.2.0 é a primeira versão com os _fuses_ do Electron ligados (`electronFuses` no `electron-builder.yml`). Antes de publicar, abra o app gerado (Mac e, se possível, Windows) e confira que ele inicia e conecta normalmente.

## Primeira vez (0.1.0 → 0.2.0)

A 0.1.0 não sabe se atualizar. Quem está nela instala a 0.2.0 manualmente, por cima; daí em diante as versões chegam pelo app.
