# Refined Redmine

- Leia `PROJECT.md` antes de mexer no projeto: é a base de conhecimento (convenções de Redmine suportadas, decisões, arquitetura, pendências).
- **O repositório é público**: nada específico do Redmine da empresa (nomes de projeto, ids, campos, valores, pessoas, URLs) vai para arquivos versionados, testes ou capturas. Isso fica em `NOTAS-INTERNAS.md` (fora do git); testes e o Redmine falso usam dados fictícios.
- **Sempre que algo for implementado, alterado ou descoberto, atualize o `PROJECT.md`** na mesma tarefa: a seção relevante, a lista de pendências (marque o que foi feito) e uma linha no Histórico. Atualize também o `README.md` se o uso mudar.
- Mudou timers, requisições, arquivos, cache ou segurança? Atualize `docs/FUNCIONAMENTO.md`.
- **Regra de negócio nova ou alterada vai para `docs/REGRAS-DE-NEGOCIO.md`** (com o nome da função onde está). Funcionalidade visível nova ou alterada vai para `docs/MANUAL.md` (capturas com dados falsos: `scripts/demo-redmine.mjs`, ver PROJECT.md §9).
- Use Node 20.19.5 (`nvm use`) e rode `npm run check` (tipos + lint + testes) antes de concluir.
- **Branches**: o trabalho vai para a `develop`; o `master` só recebe merge da `develop` ou correção urgente (`docs/RELEASE.md` → Branches). Não faça commit no `master` sem o usuário pedir.
- Builds (`dist:*`), `npm install`, `npm run release`, commits e push quem roda é o usuário. Publicação de versão: **automática** pelo GitHub Actions a cada push no `master` com commit `feat:`/`fix:`, e a própria Action traz o commit de release de volta para a `develop` (`docs/RELEASE.md`); depois de cada versão, `git pull` na `develop`. Não mude a versão no `package.json`; escreva as notas em `## Próxima versão` no topo do `CHANGELOG.md` e use os prefixos `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:` nos commits.
- **Todo o código em inglês**: identificadores, comentários, nomes de teste, logs e mensagens de erro. Outros idiomas só nos valores dos arquivos de `src/shared/i18n/locales/`. Dados reais do Redmine (nomes de status/campos em português) podem aparecer em testes e em heurísticas de reconhecimento.

## Arquitetura (resumo — detalhes em PROJECT.md §4)

- Camadas: `domain` (puro) ← `application` (casos de uso + portas) ← `infra` (adaptadores) ← `main` (composition root). A interface (`renderer`) só fala com o processo principal pelo contrato em `contracts/api.ts`.
- O lint (`eslint-plugin-boundaries`) bloqueia dependências proibidas; não contorne com caminhos relativos.
- Regra de negócio nova vai para `domain/` com teste ao lado. Nada de `new Date()` implícito no domínio: receba o "agora" por parâmetro.
- Acesso externo novo = porta em `application/ports` + adaptador em `infra/` + ligação em `main/container.ts`.
- Método novo no contrato: `RefinedApi` + `API_METHODS` (preload e roteador IPC são gerados a partir deles).
- Interface em atomic design (`ui/atoms` → `molecules` → `organisms` → `templates` → `pages`); dados via hooks em `renderer/src/hooks`.
- Todo texto visível vai para `src/shared/i18n/locales/pt-BR.ts` **e** `en-US.ts` (o tipo obriga as mesmas chaves). Erros são `AppError` com código, traduzidos em `errors.<código>`.

## Estilo de código

- **Legibilidade antes de concisão**: prefira mais linhas simples, cada uma fazendo uma coisa, a uma rotina compacta. Quebre expressões longas em constantes intermediárias com nome; extraia funções pequenas com nomes claros.
- **Nomes autoexplicativos**: nada de `i`, `e`, `s`, `d`, `o`, `r`, `q`, `n`, `c`, `cfg`, `ev`, `idx`… Use `issue`, `event`, `settings`, `occurrence`, `index`. Exceções: `t` (tradução do i18next) e `_` (não usado). Siglas comuns (`id`, `url`, `api`) podem.
- **Fluxo de controle**: sem ternário aninhado; em vez de cadeias de `if/else if`, use retorno antecipado, `switch` ou tabela de lookup (`Record`). Nada de efeito colateral escondido em `&&`, operador vírgula ou `void (a ? b() : c())`.
- **JSX**: condições complexas viram variáveis com nome ou componentes pequenos.
- **Comentários**: só para regra de negócio, decisão não óbvia/contorno (quirks do Redmine, do macOS) e algoritmo pesado. Nada de comentar arquitetura/padrões ("port", "adapter", "Clean Architecture", "use case"), repetir o que o código diz ou divisórias `// ----`.
- **Formatação**: Prettier (4 espaços, 120 colunas). O ESLint verifica nomes curtos, ternário aninhado, complexidade e profundidade.
