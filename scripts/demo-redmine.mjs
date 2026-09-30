// Fake Redmine with fictional data, used to take the user manual screenshots without exposing real tasks.
// Usage: node scripts/demo-redmine.mjs [--seed <profile dir>] [--port 4567]
// Then: REFINED_REDMINE_USER_DATA=<profile dir> npm run dev
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'

const DAY_MS = 86_400_000

function argument(name, fallback) {
    const index = process.argv.indexOf(name)
    if (index === -1) return fallback
    return process.argv[index + 1]
}

const port = Number(argument('--port', 4567))
const seedDir = argument('--seed')
const now = new Date()

function daysAgo(days, hour = 10) {
    const date = new Date(now.getTime() - days * DAY_MS)
    date.setHours(hour, 15, 0, 0)
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function localDate(offsetDays) {
    const date = new Date(now.getTime() + offsetDays * DAY_MS)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
}

const me = { id: 1, login: 'marina.costa', firstname: 'Marina', lastname: 'Costa', mail: 'marina@example.com' }
const people = {
    marina: { id: 1, name: 'Marina Costa' },
    lucas: { id: 2, name: 'Lucas Pereira' },
    beatriz: { id: 3, name: 'Beatriz Lima' },
    rafael: { id: 4, name: 'Rafael Alves' }
}

const statuses = [
    { id: 1, name: 'Nova', is_closed: false },
    { id: 2, name: 'Em andamento', is_closed: false },
    { id: 8, name: 'Em pausa', is_closed: false },
    { id: 44, name: 'Em aprovação', is_closed: false },
    { id: 110, name: 'Em teste', is_closed: false },
    { id: 3, name: 'Resolvida', is_closed: false },
    { id: 5, name: 'Finalizada', is_closed: true }
]
const statusById = new Map(statuses.map((status) => [status.id, status]))

const project = { id: 10, name: 'Loja Virtual - Desenvolvimento' }
const trackers = { dev: { id: 1, name: 'Desenvolvimento' }, bug: { id: 2, name: 'Defeito' } }
const priorities = {
    normal: { id: 2, name: 'Normal' },
    high: { id: 3, name: 'Alta' },
    urgent: { id: 4, name: 'Urgente' }
}

function version(id, name, status, devDeadline, release) {
    return {
        id,
        name,
        project,
        description: '',
        status,
        due_date: release,
        sharing: 'none',
        custom_fields: [
            { id: 11, name: 'Prazo dos devs', value: devDeadline },
            { id: 12, name: 'Publicação', value: release }
        ]
    }
}

const versions = [
    version(376, '3.76', 'closed', localDate(-26), localDate(-12)),
    version(377, '3.77', 'open', localDate(-6), localDate(2)),
    version(3771, '3.77.1', 'open', null, localDate(1)),
    version(378, '3.78', 'open', localDate(8), localDate(17)),
    version(379, '3.79', 'open', localDate(22), localDate(31)),
    { ...version(900, 'Backlog', 'open', null, null), custom_fields: [] }
]
const versionById = new Map(versions.map((item) => [item.id, item]))

function issue(id, subject, fields) {
    const {
        tracker = 'dev',
        status = 1,
        priority = 'normal',
        assignee,
        author = 'lucas',
        versionId,
        updatedDays = 1
    } = fields
    return {
        id,
        project,
        tracker: trackers[tracker],
        status: statusById.get(status),
        priority: priorities[priority],
        author: people[author],
        assigned_to: assignee ? people[assignee] : undefined,
        fixed_version: versionId ? { id: versionId, name: versionById.get(versionId).name } : undefined,
        subject,
        start_date: localDate(-updatedDays - 3),
        due_date: fields.due ?? null,
        done_ratio: fields.done ?? 0,
        estimated_hours: fields.hours ?? null,
        created_on: daysAgo(updatedDays + 6),
        updated_on: daysAgo(updatedDays, fields.hour ?? 10),
        closed_on: status === 5 ? daysAgo(updatedDays) : null,
        description: fields.description ?? null,
        watcherIds: fields.watchers ?? [],
        journals: fields.journals ?? []
    }
}

const checkoutDescription = [
    'Hoje o cliente precisa preencher o endereço inteiro no checkout.',
    '',
    '### Critérios de aceite',
    '- Buscar o endereço pelo **CEP** assim que o campo perder o foco',
    '- Permitir editar os campos preenchidos',
    '- Exibir erro amigável quando o CEP não existir',
    '',
    '| Campo | Origem |',
    '| --- | --- |',
    '| Rua, bairro | API de CEP |',
    '| Número | Cliente |'
].join('\n')

const issues = [
    issue(1201, 'Preencher endereço automaticamente pelo CEP no checkout', {
        status: 2,
        priority: 'high',
        assignee: 'marina',
        versionId: 378,
        done: 60,
        hours: 16,
        due: localDate(6),
        description: checkoutDescription,
        watchers: [2, 3],
        journals: [
            {
                id: 1,
                user: people.lucas,
                notes: 'Podemos usar o mesmo serviço de CEP do cadastro de lojas.',
                created_on: daysAgo(3),
                details: []
            },
            {
                id: 2,
                user: people.marina,
                notes: '',
                created_on: daysAgo(2),
                details: [{ property: 'attr', name: 'status_id', old_value: '1', new_value: '2' }]
            },
            {
                id: 3,
                user: people.beatriz,
                notes: '@marina.costa o layout do formulário já está no Figma, página *Checkout v2*.',
                created_on: daysAgo(1),
                details: []
            }
        ]
    }),
    issue(1202, 'Cupom de desconto não aplica em produtos com variação', {
        tracker: 'bug',
        status: 1,
        priority: 'urgent',
        assignee: 'marina',
        versionId: 3771,
        due: localDate(1),
        updatedDays: 0,
        hour: 9
    }),
    issue(1203, 'Exportar relatório de pedidos em CSV', { status: 1, assignee: 'marina', versionId: 378, hours: 8 }),
    issue(1204, 'Tela de login não mostra erro de senha inválida', {
        tracker: 'bug',
        status: 8,
        assignee: 'marina',
        versionId: 377,
        updatedDays: 9
    }),
    issue(1205, 'Ajustar e-mail de confirmação de pedido', {
        status: 44,
        assignee: 'marina',
        versionId: 377,
        done: 100,
        updatedDays: 2
    }),
    issue(1206, 'Filtro de produtos por faixa de preço', {
        status: 110,
        assignee: 'marina',
        versionId: 377,
        done: 100,
        updatedDays: 1
    }),
    issue(1207, 'Carrinho perde itens ao trocar de aba', {
        tracker: 'bug',
        status: 2,
        priority: 'high',
        assignee: 'marina',
        versionId: 377,
        done: 30,
        updatedDays: 7,
        due: localDate(-1)
    }),
    issue(1208, 'Página de rastreio de entrega', { status: 1, assignee: 'marina', versionId: 379, updatedDays: 4 }),
    issue(1209, 'Otimizar imagens da vitrine', { status: 2, assignee: 'lucas', versionId: 378, done: 40 }),
    issue(1210, 'Integração com gateway de pagamento Pix', {
        status: 2,
        priority: 'high',
        assignee: 'beatriz',
        versionId: 378,
        done: 20,
        watchers: [1]
    }),
    issue(1211, 'Newsletter no rodapé da loja', { status: 1, assignee: 'rafael', versionId: 378 }),
    issue(1212, 'Avaliações de produto com fotos', { status: 44, assignee: 'lucas', versionId: 378, done: 100 }),
    issue(1213, 'Frete grátis acima de um valor configurável', {
        status: 110,
        assignee: 'beatriz',
        versionId: 377,
        done: 100
    }),
    issue(1214, 'Erro 500 ao salvar endereço sem complemento', {
        tracker: 'bug',
        status: 5,
        assignee: 'rafael',
        versionId: 377,
        done: 100,
        updatedDays: 3
    }),
    issue(1215, 'Lista de desejos compartilhável', { status: 1, assignee: 'lucas', versionId: 379, author: 'marina' }),
    issue(1216, 'Revisar textos da página de trocas', { status: 3, assignee: 'rafael', versionId: 3771, done: 100 })
]
const issueById = new Map(issues.map((item) => [item.id, item]))

const savedQueries = [
    { id: 71, name: 'Defeitos abertos da loja', is_public: true, project_id: project.id },
    { id: 72, name: 'Aguardando minha aprovação', is_public: false, project_id: null }
]

const queryFilters = {
    71: (item) => item.tracker.id === trackers.bug.id && !item.status.is_closed,
    72: (item) => item.status.id === 44
}

function matchesPerson(value, person) {
    if (!value) return true
    if (!person) return false
    const expectedId = value === 'me' ? me.id : Number(value)
    return person.id === expectedId
}

function matchesStatus(value, status) {
    if (!value || value === 'open') return !status.is_closed
    if (value === '*') return true
    if (value === 'closed') return status.is_closed
    return value.split('|').map(Number).includes(status.id)
}

function matchesFilter(item, params) {
    const queryId = params.get('query_id')
    if (queryId) return queryFilters[queryId]?.(item) ?? false

    const watcher = params.get('watcher_id')
    const isWatching = !watcher || item.watcherIds.includes(me.id)
    const versionId = params.get('fixed_version_id')
    const updatedSince = params.get('updated_on')?.replace('>=', '')
    const projectId = params.get('project_id')
    return (
        matchesPerson(params.get('assigned_to_id'), item.assigned_to) &&
        matchesPerson(params.get('author_id'), item.author) &&
        matchesStatus(params.get('status_id'), item.status) &&
        isWatching &&
        (!projectId || Number(projectId) === project.id) &&
        (!versionId || item.fixed_version?.id === Number(versionId)) &&
        (!updatedSince || item.updated_on >= updatedSince)
    )
}

function publicIssue(item) {
    const { watcherIds: _watchers, journals: _journals, description: _description, ...fields } = item
    return fields
}

function issueDetail(item) {
    return {
        ...publicIssue(item),
        description: item.description,
        spent_hours: item.done_ratio ? 6.5 : 0,
        custom_fields: [{ id: 13, name: 'Hotfix', value: '0' }],
        journals: item.journals,
        attachments:
            item.id === 1201
                ? [
                      {
                          id: 1,
                          filename: 'checkout-v2.png',
                          filesize: 184_320,
                          author: people.beatriz,
                          created_on: daysAgo(2)
                      }
                  ]
                : [],
        relations: item.id === 1201 ? [{ id: 1, issue_id: 1201, issue_to_id: 1210, relation_type: 'relates' }] : [],
        children: [],
        watchers: item.watcherIds.map((id) => Object.values(people).find((person) => person.id === id)),
        allowed_statuses: statuses
    }
}

function listIssues(params) {
    const matching = issues.filter((item) => matchesFilter(item, params))
    const sorted = matching.sort((first, second) => second.updated_on.localeCompare(first.updated_on))
    const offset = Number(params.get('offset') ?? 0)
    const limit = Number(params.get('limit') ?? 25)
    const page = sorted.slice(offset, offset + limit).map(publicIssue)
    return { issues: page, total_count: matching.length, offset, limit }
}

function updateIssue(id, body) {
    const item = issueById.get(id)
    const statusId = body.issue?.status_id
    if (statusId) item.status = statusById.get(Number(statusId))
    const notes = body.issue?.notes
    if (notes) {
        const journal = {
            id: item.journals.length + 100,
            user: people.marina,
            notes,
            created_on: daysAgo(0),
            details: []
        }
        item.journals.push(journal)
    }
    item.updated_on = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Demo only: someone else changes an issue (POST /__demo/change?issue=1209&status=44&user=lucas&note=…). */
function simulateChange(params) {
    const item = issueById.get(Number(params.get('issue')))
    if (!item) return undefined
    const user = people[params.get('user') ?? 'lucas']
    const details = []
    const statusId = Number(params.get('status'))
    if (statusId) {
        details.push({
            property: 'attr',
            name: 'status_id',
            old_value: String(item.status.id),
            new_value: String(statusId)
        })
        item.status = statusById.get(statusId)
    }
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const journal = {
        id: 1000 + item.journals.length,
        user,
        notes: params.get('note') ?? '',
        created_on: nowIso,
        details
    }
    item.journals.push(journal)
    item.updated_on = nowIso
    return { ok: true }
}

function route(method, url, body) {
    const path = url.pathname
    if (path === '/__demo/change') return simulateChange(url.searchParams)
    if (path === '/my/account.json') return { user: me }
    if (path === '/issue_statuses.json') return { issue_statuses: statuses }
    if (path === '/projects.json') return { projects: [{ ...project, identifier: 'loja' }], total_count: 1 }
    if (path === '/queries.json') return { queries: savedQueries, total_count: savedQueries.length }
    if (path === `/projects/${project.id}/versions.json`) return { versions }
    if (path === '/issues.json') return listIssues(url.searchParams)

    const issueMatch = path.match(/^\/issues\/(\d+)\.json$/)
    const item = issueMatch && issueById.get(Number(issueMatch[1]))
    if (!item) return undefined
    if (method === 'PUT') {
        updateIssue(item.id, body)
        return {}
    }
    return { issue: issueDetail(item) }
}

function readBody(request) {
    return new Promise((resolve) => {
        let text = ''
        request.on('data', (chunk) => (text += chunk))
        request.on('end', () => resolve(text ? JSON.parse(text) : {}))
    })
}

function startServer() {
    const server = createServer(async (request, response) => {
        const url = new URL(request.url, `http://localhost:${port}`)
        const body = await readBody(request)
        const result = route(request.method, url, body)
        response.writeHead(result ? 200 : 404, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(result ?? { errors: ['Not found'] }))
    })
    server.listen(port, () => console.log(`demo Redmine on http://localhost:${port}`))
}

function column(id, name, statusIds) {
    return { id, name, statusIds }
}

function demoConfig() {
    const columns = [
        column('c-new', 'A fazer', [1]),
        column('c-doing', 'Em andamento', [2, 8]),
        column('c-review', 'Em aprovação', [44]),
        column('c-test', 'Em teste', [110, 3]),
        column('c-done', 'Finalizada', [5])
    ]
    return {
        baseUrl: `http://localhost:${port}`,
        apiKeyPlain: 'demo',
        user: me,
        language: 'pt-BR',
        pollSeconds: 600,
        boards: [
            { id: 'b-mine', name: 'Minha fila', source: { type: 'mine' }, columns, swimlanes: 'none' },
            {
                id: 'b-sprint',
                name: 'Sprint atual',
                source: { type: 'sprint', auto: 'dev' },
                columns,
                swimlanes: 'assignee'
            }
        ],
        customQueries: [
            { id: 'q-bugs', name: 'Defeitos abertos da loja', queryId: 71, alertOn: 'increase', enabled: true }
        ],
        sprints: { sprintPattern: '^\\d+\\.\\d+$', hotfixPattern: '^\\d+\\.\\d+\\.\\d+$', projectId: project.id },
        dashboard: { staleDays: 5 }
    }
}

function notification(id, kind, payload, minutesAgo, read) {
    const issueId = payload.issue?.id
    const target = issueId
        ? { type: 'url', url: `http://localhost:${port}/issues/${issueId}` }
        : { type: 'route', route: '/calendar' }
    const createdAt = new Date(now.getTime() - minutesAgo * 60_000).toISOString()
    return { id, kind, payload, issueId, target, createdAt, read }
}

function ref(id) {
    const item = issueById.get(id)
    return { id, subject: item.subject, tracker: item.tracker.name, project: project.name }
}

function demoState() {
    const events = [
        notification(
            'n1',
            'mention',
            {
                type: 'issueChanged',
                issue: ref(1201),
                actor: 'Beatriz Lima',
                changes: [
                    { type: 'mentioned', excerpt: 'o layout do formulário já está no Figma, página Checkout v2.' }
                ]
            },
            12,
            false
        ),
        notification(
            'n2',
            'new_issue',
            { type: 'issueCreated', issue: ref(1202), actor: 'Lucas Pereira', assignedToYou: true },
            45,
            false
        ),
        notification(
            'n3',
            'status',
            {
                type: 'issueChanged',
                issue: ref(1205),
                actor: 'Marina Costa',
                changes: [{ type: 'statusChanged', from: 'Em andamento', to: 'Em aprovação' }]
            },
            180,
            false
        ),
        notification(
            'n4',
            'unqueued',
            {
                type: 'queueExit',
                issue: ref(1214),
                actor: 'Rafael Alves',
                reasons: [{ type: 'reassigned', to: 'Rafael Alves' }]
            },
            320,
            true
        ),
        notification(
            'n5',
            'query',
            { type: 'queryChanged', queryName: 'Defeitos abertos da loja', from: 2, to: 3, added: [ref(1207)] },
            1500,
            true
        ),
        notification(
            'n6',
            'comment',
            {
                type: 'issueChanged',
                issue: ref(1201),
                actor: 'Lucas Pereira',
                changes: [{ type: 'commented', excerpt: 'Podemos usar o mesmo serviço de CEP do cadastro de lojas.' }]
            },
            2900,
            true
        )
    ]
    return {
        lastCheckAt: new Date().toISOString(),
        notify: { ok: true, at: now.toISOString() },
        events,
        querySnapshots: {}
    }
}

function event(id, title, fields) {
    return {
        id,
        title,
        color: fields.color ?? 'peacock',
        allDay: fields.allDay ?? false,
        start: fields.start,
        end: fields.end,
        reminders: fields.reminders ?? [10],
        recurrence: fields.recurrence,
        location: fields.location,
        description: fields.description,
        issueId: fields.issueId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    }
}

function demoCalendar() {
    const today = localDate(0)
    const tomorrow = localDate(1)
    const inTwoDays = localDate(2)
    const events = [
        event('e-daily', 'Daily', {
            color: 'basil',
            start: `${localDate(-7)}T09:30`,
            end: `${localDate(-7)}T09:45`,
            recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] },
            location: 'Google Meet'
        }),
        event('e-review', 'Review da sprint 3.77', {
            color: 'grape',
            start: `${inTwoDays}T14:00`,
            end: `${inTwoDays}T15:00`,
            reminders: [10, 1440]
        }),
        event('e-pair', 'Pareamento: CEP no checkout', {
            color: 'tangerine',
            start: `${today}T15:00`,
            end: `${today}T16:30`,
            issueId: 1201
        }),
        event('e-1on1', '1:1 com a liderança', {
            color: 'lavender',
            start: `${tomorrow}T11:00`,
            end: `${tomorrow}T11:30`,
            recurrence: { freq: 'weekly', interval: 2, byWeekday: [new Date(now.getTime() + DAY_MS).getDay()] }
        }),
        event('e-dentist', 'Dentista', {
            color: 'graphite',
            start: `${localDate(3)}T08:00`,
            end: `${localDate(3)}T09:00`
        }),
        event('e-trip', 'Treinamento externo', {
            color: 'banana',
            allDay: true,
            start: localDate(9),
            end: localDate(10),
            reminders: []
        })
    ]
    return { version: 1, events, fired: {} }
}

function seedProfile(directory) {
    mkdirSync(directory, { recursive: true })
    const write = (name, content) => writeFileSync(join(directory, name), JSON.stringify(content, null, 2))
    write('config.json', demoConfig())
    write('state.json', demoState())
    write('calendar.json', demoCalendar())
    console.log(`demo profile written to ${directory}`)
}

if (seedDir) seedProfile(seedDir)
startServer()
