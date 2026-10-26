// Fake Redmine with fictional data, used to take the user manual screenshots without exposing real tasks.
// Usage: node scripts/demo-redmine.mjs [--seed <profile dir>] [--port 4567]
// Then: REFINED_REDMINE_USER_DATA=<profile dir> npm run dev
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
const trackers = {
    dev: { id: 1, name: 'Desenvolvimento' },
    bug: { id: 2, name: 'Defeito' },
    improvement: { id: 3, name: 'Melhoria' },
    qa: { id: 4, name: 'Qualidade' }
}
const priorities = {
    low: { id: 1, name: 'Baixa' },
    normal: { id: 2, name: 'Normal' },
    high: { id: 3, name: 'Alta' },
    urgent: { id: 4, name: 'Urgente' },
    immediate: { id: 5, name: 'Imediata' }
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

const demoModules = ['Checkout', 'Catálogo', 'Pagamentos', 'Conta do cliente']
const demoRequesters = ['Comercial', 'Marina / Lucas', 'Suporte']

/**
 * Fictional custom fields, like a typical Redmine: Modulo and Solicitante required in every tracker, Categoria only in
 * Desenvolvimento, Cliente rarely filled and a checkbox. Values come from the id, so they stay the same on every start.
 */
function demoCustomFields(id, trackerKey) {
    const fields = [
        { id: 2, name: 'Modulo', value: demoModules[id % demoModules.length] },
        { id: 3, name: 'Cliente', value: id % 5 === 0 ? 'Cliente Exemplo' : '' },
        { id: 4, name: 'Solicitante', value: demoRequesters[id % demoRequesters.length] },
        { id: 5, name: 'Revisão de código', value: '0' }
    ]
    if (trackerKey === 'dev') fields.push({ id: 6, name: 'Categoria', value: id % 3 ? 'Funcionalidade' : 'Bug' })
    return fields
}

const requiredCustomFields = { dev: [2, 4, 6], bug: [2, 4], improvement: [2, 4], qa: [2, 4] }

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
        custom_fields: fields.customFields ?? demoCustomFields(id, tracker),
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
    '| Número | Cliente |',
    '',
    '### Contexto',
    '![Layout do checkout](checkout-v2.png)',
    '',
    'Hoje 38% dos clientes que abandonam o checkout param na etapa de endereço (dados fictícios do painel).',
    'O cadastro de lojas já consulta o CEP pelo mesmo serviço; a ideia é reaproveitar o cliente HTTP e o cache.',
    '',
    '### Regras',
    '1. O CEP aceita com ou sem hífen; qualquer outro caractere é removido antes da busca.',
    '2. Com o serviço fora do ar, o formulário continua manual e nada bloqueia o cliente.',
    '3. Se o cliente já editou a rua, uma nova busca não sobrescreve o que ele digitou.',
    '4. O complemento nunca é preenchido pela API.',
    '',
    '### Fora do escopo',
    '- Busca de endereço por nome de rua',
    '- Validação de entrega por região (fica para a 3.79)',
    '',
    '### Plano de testes',
    '- CEP válido de capital, de cidade pequena e de área rural',
    '- CEP inexistente e CEP com formato inválido',
    '- Serviço lento (mais de 3 s) e fora do ar',
    '- Edição manual depois da busca',
    '',
    '### Observações',
    'Os eventos de analytics continuam os mesmos; só o campo `address_source` passa a ser enviado.'
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
                notes: '@marina.costa o layout do formulário já está no Figma, página *Checkout v2*. O fluxo ficou assim:\n\n![](fluxo-cep.svg)\n\nE o vídeo do erro: ![](reproducao-erro-cep.webm)',
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
    issue(1216, 'Revisar textos da página de trocas', { status: 3, assignee: 'rafael', versionId: 3771, done: 100 }),
    issue(1220, 'QA: endereço automático pelo CEP no checkout', {
        tracker: 'qa',
        status: 1,
        assignee: 'beatriz',
        versionId: 378
    })
]
const issueById = new Map(issues.map((item) => [item.id, item]))

const savedQueries = [
    { id: 71, name: 'Defeitos abertos da loja', is_public: true, project_id: project.id },
    { id: 72, name: 'Aguardando minha aprovação', is_public: false, project_id: null },
    { id: 73, name: 'Fila do Rafael', is_public: true, project_id: project.id }
]

const queryFilters = {
    71: (item) => item.tracker.id === trackers.bug.id && !item.status.is_closed,
    72: (item) => item.status.id === 44,
    73: (item) => item.assigned_to?.id === people.rafael.id && !item.status.is_closed
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

/** Redmine's f[]/op[]/v[] form, for the fields the app uses (status and title search). */
function matchesFieldFilters(item, params) {
    return params.getAll('f[]').every((field) => {
        const operator = params.get(`op[${field}]`)
        const values = params.getAll(`v[${field}][]`)
        if (field === 'status_id') {
            if (operator === '*') return true
            if (operator === 'o') return !item.status.is_closed
            if (operator === 'c') return item.status.is_closed
            return values.map(Number).includes(item.status.id)
        }
        if (field === 'subject') {
            const needle = (values[0] ?? '').toLowerCase()
            return item.subject.toLowerCase().includes(needle)
        }
        return true
    })
}

function matchesFilter(item, params) {
    const issueIds = params.get('issue_id')
    if (issueIds) return issueIds.split(',').map(Number).includes(item.id)
    const parentIds = params.get('parent_id')
    if (parentIds) return parentIds.split(',').map(Number).includes(parentOf(item.id)?.id)
    const queryId = params.get('query_id')
    if (queryId) return queryFilters[queryId]?.(item) ?? false
    if (params.getAll('f[]').length) return matchesFieldFilters(item, params)

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

/** A one-page PDF with a line of text, with the byte offsets PDF readers need. */
function tinyPdf(text) {
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${text.length + 40} >>\nstream\nBT /F1 18 Tf 60 760 Td (${text}) Tj ET\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ]
    let pdf = '%PDF-1.4\n'
    const offsets = objects.map((object, index) => {
        const offset = pdf.length
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
        return offset
    })
    const xref = pdf.length
    const entries = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}`
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    return Buffer.from(pdf, 'latin1')
}

const cepFlowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="160" font-family="sans-serif" font-size="14">
<rect width="480" height="160" fill="#f6f7f9"/>
<rect x="20" y="55" width="120" height="50" rx="8" fill="#4f7cff"/><text x="80" y="85" fill="#fff" text-anchor="middle">CEP digitado</text>
<rect x="180" y="55" width="120" height="50" rx="8" fill="#22a06b"/><text x="240" y="85" fill="#fff" text-anchor="middle">API de CEP</text>
<rect x="340" y="55" width="120" height="50" rx="8" fill="#e2b203"/><text x="400" y="85" text-anchor="middle">Campos</text>
<path d="M140 80h40M300 80h40" stroke="#555" stroke-width="2"/></svg>`

const checkoutLog = [
    '2026-09-29 14:02:11 INFO  checkout.address  CEP 01310-100 consultado em 182 ms',
    '2026-09-29 14:02:11 INFO  checkout.address  Endereço preenchido: Avenida Paulista, Bela Vista',
    '2026-09-29 14:05:43 WARN  checkout.address  CEP 99999-999 não encontrado na API',
    '2026-09-29 14:05:43 ERROR checkout.address  Resposta 404 da API de CEP; campo liberado para digitação manual',
    '2026-09-29 14:07:02 INFO  checkout.submit   Pedido 88231 criado com endereço preenchido automaticamente'
].join('\n')

const cepResponse = JSON.stringify({
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    bairro: 'Bela Vista',
    localidade: 'São Paulo',
    uf: 'SP',
    ibge: '3550308'
})

const demoAttachments = [
    {
        id: 1,
        issueId: 1201,
        filename: 'checkout-v2.png',
        content_type: 'image/png',
        author: people.beatriz,
        created_on: daysAgo(2),
        bytes: () => readFileSync(new URL('../docs/images/board.png', import.meta.url))
    },
    {
        id: 2,
        issueId: 1201,
        filename: 'fluxo-cep.svg',
        content_type: 'image/svg+xml',
        author: people.lucas,
        created_on: daysAgo(2),
        bytes: () => Buffer.from(cepFlowSvg)
    },
    {
        id: 3,
        issueId: 1201,
        filename: 'checkout-erros.log',
        content_type: 'text/plain',
        author: people.marina,
        created_on: daysAgo(1),
        bytes: () => Buffer.from(checkoutLog)
    },
    {
        id: 4,
        issueId: 1201,
        filename: 'resposta-api-cep.json',
        content_type: 'application/json',
        author: people.lucas,
        created_on: daysAgo(1),
        bytes: () => Buffer.from(cepResponse)
    },
    {
        id: 5,
        issueId: 1201,
        filename: 'especificacao-checkout.pdf',
        content_type: 'application/pdf',
        author: people.beatriz,
        created_on: daysAgo(3),
        bytes: () => tinyPdf('Especificacao do checkout: preencher endereco pelo CEP')
    },
    {
        id: 6,
        issueId: 1201,
        filename: 'backup-enderecos.zip',
        content_type: 'application/zip',
        author: people.rafael,
        created_on: daysAgo(4),
        bytes: () => Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)])
    },
    {
        id: 7,
        issueId: 1201,
        filename: 'reproducao-erro-cep.webm',
        content_type: 'video/webm',
        author: people.beatriz,
        created_on: daysAgo(1),
        bytes: () => readFileSync(new URL('./demo-assets/reproducao-erro-cep.webm', import.meta.url))
    }
]

// Files sent to /uploads.json, waiting for the issue that attaches them by token.
const pendingUploads = new Map()

function storeUpload(params, bytes) {
    const token = `${pendingUploads.size + 1}.demo${Date.now()}`
    pendingUploads.set(token, { filename: params.get('filename') ?? 'arquivo', bytes })
    return { upload: { id: pendingUploads.size, token } }
}

function attachUploads(issueId, uploads = []) {
    for (const reference of uploads) {
        const upload = pendingUploads.get(reference.token)
        if (!upload) continue
        pendingUploads.delete(reference.token)
        demoAttachments.push({
            id: Math.max(...demoAttachments.map((attachment) => attachment.id)) + 1,
            issueId,
            filename: reference.filename ?? upload.filename,
            content_type: reference.content_type ?? 'application/octet-stream',
            author: people.marina,
            created_on: daysAgo(0),
            bytes: () => upload.bytes
        })
    }
}

function attachmentsOf(issueId) {
    return demoAttachments.filter((attachment) => attachment.issueId === issueId)
}

function attachmentInfo(attachment) {
    const { issueId: _issueId, bytes, ...info } = attachment
    return { ...info, filesize: bytes().length }
}

/** GET /attachments/download/:id, with the same key check as the API. */
function serveDownload(request, response, path) {
    const match = path.match(/^\/attachments\/download\/(\d+)/)
    const attachment = match && demoAttachments.find((item) => item.id === Number(match[1]))
    if (request.headers['x-redmine-api-key'] !== DEMO_API_KEY) {
        response.writeHead(401)
        response.end()
        return
    }
    if (!attachment) {
        response.writeHead(404)
        response.end()
        return
    }
    const bytes = attachment.bytes()
    response.writeHead(200, { 'Content-Type': attachment.content_type, 'Content-Length': bytes.length })
    response.end(bytes)
}

// Relations and subtasks of #1201, seen from both sides (Redmine returns each relation on both issues).
const relations = [
    { id: 1, issue_id: 1201, issue_to_id: 1210, relation_type: 'relates' },
    { id: 2, issue_id: 1204, issue_to_id: 1201, relation_type: 'blocks' },
    { id: 3, issue_id: 1201, issue_to_id: 1208, relation_type: 'precedes' },
    { id: 4, issue_id: 1214, issue_to_id: 1201, relation_type: 'relates' },
    { id: 5, issue_id: 1220, issue_to_id: 1201, relation_type: 'relates' }
]
const children = { 1201: [1211, 1213, 1216] }

function childIds(id) {
    return children[id] ?? []
}

function parentOf(id) {
    const parentId = Object.keys(children).find((key) => children[key].includes(id))
    return parentId ? { id: Number(parentId) } : undefined
}

function publicIssue(item) {
    const { watcherIds: _watchers, journals: _journals, description: _description, ...fields } = item
    return { ...fields, parent: parentOf(item.id) }
}

function issueDetail(item) {
    return {
        ...publicIssue(item),
        description: item.description,
        spent_hours: spentOn(item.id),
        journals: item.journals,
        attachments: attachmentsOf(item.id).map(attachmentInfo),
        relations: relations.filter((relation) => [relation.issue_id, relation.issue_to_id].includes(item.id)),
        children: childIds(item.id).map((id) => {
            const child = issueById.get(id)
            return { id, tracker: child.tracker, subject: child.subject }
        }),
        parent: parentOf(item.id),
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

const personById = (id) => Object.values(people).find((person) => person.id === Number(id))

/** Applies the editable fields like Redmine: "" clears; in "Em teste" the version is read-only and silently kept. */
function updateFields(item, fields) {
    const details = []
    const change = (name, oldValue, newValue) =>
        details.push({ property: 'attr', name, old_value: oldValue, new_value: newValue })
    if ('assigned_to_id' in fields) {
        change('assigned_to_id', item.assigned_to?.id ?? null, fields.assigned_to_id || null)
        item.assigned_to = fields.assigned_to_id ? personById(fields.assigned_to_id) : undefined
    }
    const versionReadOnly = item.status.id === 110
    if ('fixed_version_id' in fields && !versionReadOnly) {
        const version = versionById.get(Number(fields.fixed_version_id))
        change('fixed_version_id', item.fixed_version?.id ?? null, fields.fixed_version_id || null)
        item.fixed_version = version ? { id: version.id, name: version.name } : undefined
    }
    if ('priority_id' in fields) {
        change('priority_id', item.priority.id, fields.priority_id)
        item.priority = Object.values(priorities).find((priority) => priority.id === Number(fields.priority_id))
    }
    for (const [name, key] of [
        ['start_date', 'start_date'],
        ['due_date', 'due_date']
    ]) {
        if (!(name in fields)) continue
        change(name, item[key], fields[name] || null)
        item[key] = fields[name] || null
    }
    if ('done_ratio' in fields) {
        change('done_ratio', item.done_ratio, fields.done_ratio)
        item.done_ratio = Number(fields.done_ratio)
    }
    return details
}

function setParent(id, parentId) {
    for (const key of Object.keys(children)) children[key] = children[key].filter((childId) => childId !== id)
    if (parentId) children[parentId] = [...(children[parentId] ?? []), id]
}

function updatePlanningFields(item, fields, change) {
    if ('estimated_hours' in fields) {
        change('estimated_hours', item.estimated_hours, fields.estimated_hours)
        item.estimated_hours = fields.estimated_hours === '' ? null : Number(fields.estimated_hours)
    }
    if ('parent_issue_id' in fields) {
        change('parent_id', parentOf(item.id)?.id ?? null, fields.parent_issue_id || null)
        setParent(item.id, Number(fields.parent_issue_id) || null)
    }
}

function updateTextFields(item, fields, change) {
    if ('subject' in fields) {
        change('subject', item.subject, fields.subject)
        item.subject = fields.subject
    }
    if ('description' in fields) {
        change('description', item.description, fields.description)
        item.description = fields.description || null
    }
    if ('tracker_id' in fields) {
        const tracker = Object.values(trackers).find((candidate) => candidate.id === Number(fields.tracker_id))
        change('tracker_id', item.tracker.id, fields.tracker_id)
        item.tracker = tracker ?? item.tracker
    }
}

/** POST /issues.json: like Redmine, the title is required and the tracker defaults to the project's first. */
function createIssue(fields) {
    const tracker = Object.keys(trackers).find((key) => trackers[key].id === Number(fields.tracker_id)) ?? 'dev'
    const errors = createErrors(fields, tracker)
    if (errors.length) return { errors }
    const id = Math.max(...issues.map((item) => item.id)) + 1
    const priority = Object.keys(priorities).find((key) => priorities[key].id === Number(fields.priority_id))
    const assignee = Object.keys(people).find((key) => people[key].id === Number(fields.assigned_to_id))
    const created = issue(id, fields.subject, {
        tracker,
        priority: priority ?? 'normal',
        assignee,
        author: 'marina',
        versionId: fields.fixed_version_id ? Number(fields.fixed_version_id) : undefined,
        due: fields.due_date ?? null,
        description: fields.description ?? null,
        customFields: newCustomFields(tracker, fields.custom_fields),
        updatedDays: 0
    })
    created.start_date = fields.start_date ?? null
    created.estimated_hours = fields.estimated_hours ?? null
    if (fields.parent_issue_id) setParent(id, Number(fields.parent_issue_id))
    attachUploads(id, fields.uploads)
    created.created_on = created.updated_on = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    issues.push(created)
    issueById.set(id, created)
    return { issue: publicIssue(created) }
}

function createErrors(fields, tracker) {
    const errors = []
    if (!fields.subject?.trim()) errors.push('Título não pode ficar em branco')
    const sent = new Map((fields.custom_fields ?? []).map((field) => [field.id, String(field.value ?? '').trim()]))
    const names = new Map(demoCustomFields(0, tracker).map((field) => [field.id, field.name]))
    for (const fieldId of requiredCustomFields[tracker]) {
        if (!sent.get(fieldId)) errors.push(`${names.get(fieldId)} não pode ficar em branco`)
    }
    return errors
}

/** The tracker's fields with what was sent; the others, like Redmine, are ignored. */
function newCustomFields(tracker, sent = []) {
    return demoCustomFields(0, tracker).map((field) => {
        const value = sent.find((entry) => entry.id === field.id)?.value
        return { ...field, value: value ?? (field.id === 5 ? '0' : '') }
    })
}

function updateIssue(id, body) {
    const item = issueById.get(id)
    const statusId = body.issue?.status_id
    if (statusId) item.status = statusById.get(Number(statusId))
    const details = updateFields(item, body.issue ?? {})
    const change = (name, oldValue, newValue) =>
        details.push({ property: 'attr', name, old_value: oldValue, new_value: newValue })
    updateTextFields(item, body.issue ?? {}, change)
    updatePlanningFields(item, body.issue ?? {}, change)
    if (details.length) {
        item.journals.push({
            id: item.journals.length + 100,
            user: people.marina,
            notes: '',
            created_on: daysAgo(0),
            details
        })
    }
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
    attachUploads(id, body.issue?.uploads)
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

const timeActivities = [
    { id: 8, name: 'Análise', is_default: false, active: true },
    { id: 9, name: 'Desenvolvimento', is_default: true, active: true },
    { id: 10, name: 'Reunião', is_default: false, active: true },
    { id: 11, name: 'Testes', is_default: false, active: true }
]
const activityById = new Map(timeActivities.map((activity) => [activity.id, activity]))

/** Fictional time entries: Marina's last and current week, plus a colleague's entry. */
let nextTimeEntryId = 500
function timeEntry(issueId, offsetDays, hours, activityId, comments, user = people.marina) {
    nextTimeEntryId += 1
    return {
        id: nextTimeEntryId,
        project,
        issue: { id: issueId },
        user,
        activity: activityById.get(activityId),
        hours,
        comments,
        spent_on: localDate(offsetDays),
        created_on: daysAgo(Math.max(0, -offsetDays)),
        updated_on: daysAgo(Math.max(0, -offsetDays))
    }
}
const timeEntries = [
    timeEntry(1201, -8, 3, 9, 'Busca do endereço pelo CEP'),
    timeEntry(1201, -7, 2.5, 9, 'Validação e mensagens de erro'),
    timeEntry(1203, -7, 1, 10, 'Alinhamento do relatório com o time'),
    timeEntry(1206, -6, 4, 9, 'Filtro por faixa de preço'),
    timeEntry(1201, -1, 2, 9, 'Ajustes do layout do formulário'),
    timeEntry(1206, -1, 1.5, 11, 'Testes do filtro'),
    timeEntry(1201, 0, 1, 10, 'Daily e revisão'),
    timeEntry(1201, -2, 3, 9, 'Integração com a API de CEP', people.lucas),
    timeEntry(1210, -1, 5, 9, 'Webhook do Pix', people.lucas),
    timeEntry(1209, 0, 2, 9, 'Compressão das imagens', people.lucas),
    timeEntry(1213, -1, 4, 11, 'Cenários de frete grátis', people.beatriz),
    timeEntry(1210, -2, 3.5, 9, 'Tela de pagamento', people.beatriz),
    timeEntry(1211, -1, 2, 9, 'Formulário da newsletter', people.rafael),
    timeEntry(1216, 0, 1, 10, 'Revisão de textos com o time', people.rafael),
    // Monday of this week: Redmine used to leave it out of "this week" (see listTimeEntries).
    timeEntry(1203, -((now.getDay() + 6) % 7), 2, 8, 'Levantamento do relatório (segunda)'),
    timeEntry(1201, -((now.getDay() + 6) % 7), 1.5, 11, 'Testes do CEP (segunda)', people.beatriz)
]

const spentOn = (issueId) =>
    Math.round(
        timeEntries.filter((entry) => entry.issue?.id === issueId).reduce((sum, entry) => sum + entry.hours, 0) * 100
    ) / 100

const nextDay = (day) => {
    const date = new Date(`${day}T12:00:00`)
    date.setDate(date.getDate() + 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Like a real Redmine whose user is west of UTC (Brazil): the dates of `from`/`to` are moved by the time zone, so
 * the first day is left out and the day after `to` comes in. The app asks one more day on each side to make up for it.
 */
function listTimeEntries(params) {
    const userId = params.get('user_id') === 'me' ? me.id : Number(params.get('user_id') || 0)
    const issueId = Number(params.get('issue_id') || 0)
    const from = params.get('from')
    const to = params.get('to')
    const matching = timeEntries.filter(
        (entry) =>
            (!userId || entry.user.id === userId) &&
            (!issueId || entry.issue?.id === issueId) &&
            (!from || entry.spent_on > from) &&
            (!to || entry.spent_on <= nextDay(to))
    )
    const offset = Number(params.get('offset') ?? 0)
    const limit = Number(params.get('limit') ?? 25)
    return { time_entries: matching.slice(offset, offset + limit), total_count: matching.length, offset, limit }
}

/** Fields like Redmine: hours, date, activity (default when missing) and comments. */
function applyTimeEntryFields(entry, fields) {
    if (fields.hours !== undefined) entry.hours = Number(fields.hours)
    if (fields.spent_on) entry.spent_on = fields.spent_on
    if (fields.activity_id) entry.activity = activityById.get(Number(fields.activity_id)) ?? entry.activity
    if (fields.comments !== undefined) entry.comments = fields.comments
    if (fields.issue_id) entry.issue = { id: Number(fields.issue_id) }
    entry.updated_on = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function createTimeEntry(fields) {
    if (!issueById.has(Number(fields.issue_id))) return { errors: ['Tarefa não é válida'] }
    if (!(Number(fields.hours) > 0)) return { errors: ['Horas não é válido'] }
    const entry = timeEntry(Number(fields.issue_id), 0, 0, 9, '')
    applyTimeEntryFields(entry, fields)
    timeEntries.push(entry)
    return { time_entry: entry }
}

function timeEntryRoute(method, path, body) {
    const match = path.match(/^\/time_entries\/(\d+)\.json$/)
    const index = match ? timeEntries.findIndex((entry) => entry.id === Number(match[1])) : -1
    if (index === -1) return undefined
    if (method === 'DELETE') {
        timeEntries.splice(index, 1)
        return {}
    }
    if (method === 'PUT') applyTimeEntryFields(timeEntries[index], body.time_entry ?? {})
    return { time_entry: timeEntries[index] }
}

/** The demo profile and the connection screen use this fake key. */
const DEMO_API_KEY = 'demo'

function route(method, url, body) {
    const path = url.pathname
    if (path === '/__demo/change') return simulateChange(url.searchParams)
    if (path === '/my/account.json') return { user: me }
    if (path === '/issue_statuses.json') return { issue_statuses: statuses }
    if (path === '/trackers.json') return { trackers: Object.values(trackers) }
    if (path === '/projects.json') return { projects: [{ ...project, identifier: 'loja' }], total_count: 1 }
    if (path === '/queries.json') return { queries: savedQueries, total_count: savedQueries.length }
    if (path === `/projects/${project.id}/versions.json`) return { versions }
    if (path === `/projects/${project.id}/memberships.json`) {
        const memberships = Object.values(people).map((person, index) => ({ id: index + 1, user: person }))
        return { memberships, total_count: memberships.length }
    }
    if (path === '/enumerations/issue_priorities.json') {
        const list = Object.values(priorities).map((priority) => ({
            ...priority,
            is_default: priority.id === 2,
            active: true
        }))
        return { issue_priorities: list }
    }
    if (path === '/uploads.json' && method === 'POST') return storeUpload(url.searchParams, body)
    if (path === '/issues.json' && method === 'POST') return createIssue(body.issue ?? {})
    if (path === '/issues.json') return listIssues(url.searchParams)
    if (path === `/projects/${project.id}.json`) {
        return { project: { ...project, identifier: 'loja', trackers: Object.values(trackers) } }
    }
    if (path === '/enumerations/time_entry_activities.json') return { time_entry_activities: timeActivities }
    if (path === '/time_entries.json' && method === 'POST') return createTimeEntry(body.time_entry ?? {})
    if (path === '/time_entries.json') return listTimeEntries(url.searchParams)
    if (path.startsWith('/time_entries/')) return timeEntryRoute(method, path, body)
    const attachmentMatch = path.match(/^\/attachments\/(\d+)\.json$/)
    const attachment = attachmentMatch && demoAttachments.find((item) => item.id === Number(attachmentMatch[1]))
    if (attachment) return { attachment: attachmentInfo(attachment) }

    const issueMatch = path.match(/^\/issues\/(\d+)\.json$/)
    const item = issueMatch && issueById.get(Number(issueMatch[1]))
    if (!item) return undefined
    if (method === 'PUT') {
        updateIssue(item.id, body)
        return {}
    }
    return { issue: issueDetail(item) }
}

/** JSON, or the raw bytes of a file sent to /uploads.json. */
function readBody(request) {
    return new Promise((resolve) => {
        const chunks = []
        request.on('data', (chunk) => chunks.push(chunk))
        request.on('end', () => {
            const bytes = Buffer.concat(chunks)
            if (request.headers['content-type'] === 'application/octet-stream') return resolve(bytes)
            resolve(bytes.length ? JSON.parse(bytes.toString('utf8')) : {})
        })
    })
}

function startServer() {
    const server = createServer(async (request, response) => {
        const url = new URL(request.url, `http://localhost:${port}`)
        if (url.pathname.startsWith('/attachments/download/')) {
            serveDownload(request, response, url.pathname)
            return
        }
        const body = await readBody(request)
        // Like Redmine, an API request with another key is refused (lets the connection screen show the error).
        const isApiCall = url.pathname.endsWith('.json')
        if (isApiCall && request.headers['x-redmine-api-key'] !== DEMO_API_KEY) {
            response.writeHead(401, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify({ errors: ['Invalid API key'] }))
            return
        }
        const result = route(request.method, url, body)
        const status = result?.errors ? 422 : result ? 200 : 404
        response.writeHead(status, { 'Content-Type': 'application/json' })
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
        apiKeyPlain: DEMO_API_KEY,
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
        dashboard: { staleDays: 5 },
        teams: [{ id: 't-loja', name: 'Time da loja', members: Object.values(people) }],
        claudeActions: [
            {
                id: 'c-review',
                name: 'Code review',
                mode: 'terminal',
                folder: '/Users/marina/projetos/loja-virtual',
                template: '/review refs {{tarefa}}',
                trackerIds: [trackers.dev.id],
                statusIds: [],
                icon: 'review'
            }
        ],
        handoffRules: [
            {
                id: 'r-qa',
                name: 'Enviar para QA',
                mode: 'other',
                trackerIds: [trackers.dev.id],
                statusIds: [],
                targetTrackerId: trackers.qa.id,
                statusId: 2,
                assigneeId: people.beatriz.id,
                assigneeName: people.beatriz.name,
                template: '* Trâmite de {{tipoAtividadeComentario}}: {{noteSelecionado}}',
                multiTemplate: '* Trâmites de {{tipoAtividadeComentario}}:\n  - {{noteSelecionado}}',
                logTime: true,
                bulk: false,
                closingSteps: [{ trackerId: trackers.dev.id, statusId: 110 }]
            }
        ]
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
