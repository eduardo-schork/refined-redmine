# Publicar uma versão

As versões são publicadas como **Releases** do repositório privado `eduardo-schork/refined-redmine`. Os apps que têm um token do GitHub com acesso ao repositório encontram a versão nova sozinhos (ao abrir, depois de 30 s, e uma vez por dia).

## Uma vez só: o seu token para publicar

O script usa o token só nas chamadas à API do GitHub; os builds (`dist:*`) rodam sem ele e com `--publish never`, então nunca publicam sozinhos.

Crie um token **fine-grained** em <https://github.com/settings/personal-access-tokens/new>, só para o repositório `refined-redmine`, com **Contents: Read and write** (é o que permite criar a Release e enviar os arquivos). Um token clássico com o escopo `repo` também funciona. Guarde num gerenciador de senhas. Ele é usado só na hora de publicar, pela variável de ambiente `GITHUB_TOKEN`; não vai para o app nem para o repositório.

## A cada versão

1. **Número da versão** em `package.json` (`"version"`), seguindo [semver](https://semver.org/lang/pt-BR/): correção → `0.2.1`; funcionalidade nova → `0.3.0`.
2. **Notas** em `CHANGELOG.md`: uma seção `## <versão> — <título curto>` no topo. O script usa esse texto como descrição da Release, e o app mostra o mesmo texto na janela **O que há de novo**.
3. **Commit e push** de tudo (o script recusa se houver mudança sem commit ou commit sem push, porque a Release aponta para o `HEAD`).
4. **Publicar**:

   ```bash
   nvm use
   GITHUB_TOKEN=ghp_seu_token npm run release
   ```

   O script:
   1. confere a versão, a seção do CHANGELOG, o git e se a tag `v<versão>` ainda não existe;
   2. roda `npm run check` (tipos, lint, testes);
   3. gera os instaladores (`npm run dist:mac` e `npm run dist:win`);
   4. cria a Release como rascunho, envia os 3 instaladores e publica.

   Opções (depois de `--`): `--draft` deixa como rascunho para revisar no GitHub antes de publicar; `--skip-build` reaproveita os instaladores que já estão em `dist/`; `--allow-dirty` pula a conferência do git.

5. **Conferir** na página da Release no GitHub (o script mostra o link) e, se quiser, avisar o time.

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
