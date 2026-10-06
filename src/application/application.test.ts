import { describe, expect, it } from 'vitest'
import type { Board } from '@domain/board/board'
import { createMineMonitor, defaultEvents, type Monitor } from '@domain/monitor/monitor'
import type { Version } from '@domain/redmine/entities'
import { AppError } from '@domain/shared/errors'
import { MonitorService } from './services/monitor-service'
import { LoginUseCase } from './use-cases/session'
import { BoardFilterResolver, DeleteBoardUseCase, MoveIssueToColumnUseCase, SaveBoardUseCase } from './use-cases/boards'
import { ListSprintsUseCase } from './use-cases/sprints'
import { CreateIssueUseCase, EditIssueFieldsUseCase, IssueQueries } from './use-cases/issues'
import { ReminderDispatcher, SaveCalendarEventUseCase } from './use-cases/calendar'
import {
    detail,
    FakeEvents,
    FakeGateway,
    FakeNotifier,
    FixedClock,
    issue,
    MemoryActivityLog,
    MemoryCalendar,
    MemoryMonitorState,
    MemoryNotifications,
    MemorySecrets,
    MemorySettings,
    noScheduler,
    SeqIds
} from './testing/fakes'

const noop = () => {}

function monitorSetup() {
    const gateway = new FakeGateway()
    const settings = new MemorySettings()
    const clock = new FixedClock(new Date('2026-09-28T15:00:00Z'))
    const deps = {
        gateway,
        settings,
        secrets: new MemorySecrets(),
        state: new MemoryMonitorState(),
        notifications: new MemoryNotifications(),
        notifier: new FakeNotifier(),
        events: new FakeEvents(),
        clock,
        ids: new SeqIds(),
        scheduler: noScheduler,
        log: new MemoryActivityLog(),
        boardFilter: new BoardFilterResolver(new ListSprintsUseCase(gateway, settings, clock))
    }
    return { ...deps, monitor: new MonitorService(deps) }
}

const SINCE = '2026-09-28T14:00:00Z'
const LUCAS = { id: 8, name: 'Lucas' }
const ME_NAMED = { id: 42, name: 'Marina' }

function mineWithoutQueue(): Monitor {
    const mine = createMineMonitor({ assigned: true, watched: true, authored: true })
    return { ...mine, events: { ...mine.events, left: false } }
}

function setMonitors(setup: ReturnType<typeof monitorSetup>, monitors: Monitor[], boards: Board[] = []) {
    setup.settings.value = { ...setup.settings.value, monitors, boards }
}

describe('MonitorService', () => {
    it('first run only records the watermark', async () => {
        const setup = monitorSetup()
        await setup.monitor.runNow()
        expect(setup.state.watermark).toBe('2026-09-28T15:00:00Z')
        expect(setup.notifier.shown).toEqual([])
    })

    it('turns journals from other people into notifications and advances the watermark', async () => {
        const setup = monitorSetup()
        setup.state.watermark = '2026-09-28T14:00:00Z'
        const changed = issue(10, { updated_on: '2026-09-28T14:30:00Z' })
        setup.gateway.issues = [changed]
        setup.gateway.details.set(
            10,
            detail(changed, {
                journals: [
                    {
                        id: 1,
                        user: { id: 8, name: 'Lucas' },
                        created_on: '2026-09-28T14:30:00Z',
                        details: [{ property: 'attr', name: 'status_id', old_value: '1', new_value: '2' }]
                    },
                    {
                        id: 2,
                        user: { id: 42, name: 'Marina' },
                        created_on: '2026-09-28T14:31:00Z',
                        notes: 'done by me',
                        details: []
                    }
                ]
            })
        )
        setMonitors(setup, [mineWithoutQueue()])
        await setup.monitor.runNow()
        expect(setup.notifier.shown.map((notification) => [notification.kind, notification.payload.type])).toEqual([
            ['status', 'issueChanged']
        ])
        expect(setup.state.watermark).toBe('2026-09-28T14:30:00Z')
    })

    it('warns when an issue leaves the queue, without duplicating the status event', async () => {
        const setup = monitorSetup()
        setup.state.watermark = '2026-09-28T14:00:00Z'
        setup.state.snapshots.set('__my_queue__', { count: 1, ids: [7] })
        const closed = issue(7, {
            updated_on: '2026-09-28T14:40:00Z',
            status: { id: 5, name: 'Finalizada', is_closed: true }
        })
        setup.gateway.byFilter.set(JSON.stringify({ assignedTo: 'me', status: 'open' }), [])
        setup.gateway.issues = [closed]
        setup.gateway.details.set(
            7,
            detail(closed, {
                journals: [
                    {
                        id: 9,
                        user: { id: 8, name: 'Lucas' },
                        created_on: '2026-09-28T14:40:00Z',
                        details: [{ property: 'attr', name: 'status_id', old_value: '2', new_value: '5' }]
                    }
                ]
            })
        )
        await setup.monitor.runNow()
        expect(setup.notifier.shown.map((notification) => notification.kind)).toEqual(['unqueued'])
    })

    it('saved query: reports entries and exits, drops my own moves and merges the same change from two monitors', async () => {
        const setup = monitorSetup()
        setup.state.watermark = SINCE
        const queryMonitor: Monitor = {
            id: 'q1',
            name: 'Store bugs',
            enabled: true,
            source: { type: 'query', queryId: 71 },
            events: defaultEvents('query')
        }
        queryMonitor.events.left = true
        setMonitors(setup, [mineWithoutQueue(), queryMonitor])
        setup.state.snapshots.set('q1', { count: 2, ids: [1, 2], subjects: { 2: 'Old subject' } })

        const commented = issue(1, { updated_on: '2026-09-28T14:30:00Z' })
        const entered = issue(3, { created_on: '2026-09-28T14:20:00Z', updated_on: '2026-09-28T14:20:00Z' })
        const leftByMe = issue(2, { updated_on: '2026-09-28T14:10:00Z' })
        setup.gateway.byFilter.set(JSON.stringify({ queryId: 71 }), [commented, entered])
        setup.gateway.issues = [commented]
        setup.gateway.details.set(
            1,
            detail(commented, {
                journals: [
                    { id: 11, user: LUCAS, created_on: '2026-09-28T14:30:00Z', notes: 'Looks good', details: [] }
                ]
            })
        )
        setup.gateway.details.set(3, detail(entered))
        setup.gateway.details.set(
            2,
            detail(leftByMe, {
                journals: [
                    {
                        id: 12,
                        user: ME_NAMED,
                        created_on: '2026-09-28T14:10:00Z',
                        details: [{ property: 'attr', name: 'status_id', old_value: '1', new_value: '5' }]
                    }
                ]
            })
        )

        await setup.monitor.runNow()

        const shown = setup.notifier.shown
        const membership = shown.find((notification) => notification.payload.type === 'queryChanged')
        expect(membership?.payload).toMatchObject({
            queryName: 'Store bugs',
            from: 2,
            to: 2,
            added: [{ id: 3 }],
            removed: []
        })
        const comment = shown.find((notification) => notification.kind === 'comment')
        expect(comment?.sources?.map((source) => source.monitorId)).toEqual(['mine', 'q1'])
        expect(shown).toHaveLength(2)
    })

    it('board: a status change that moves the card shows the columns', async () => {
        const setup = monitorSetup()
        setup.state.watermark = SINCE
        const board: Board = {
            id: 'b1',
            name: 'Sprint board',
            source: { type: 'mine' },
            swimlanes: 'none',
            columns: [
                { id: 'todo', name: 'To do', statusIds: [1] },
                { id: 'doing', name: 'Doing', statusIds: [2] }
            ]
        }
        const boardMonitor: Monitor = {
            id: 'board:b1',
            name: 'Sprint board',
            enabled: true,
            source: { type: 'board', boardId: 'b1' },
            events: defaultEvents('board')
        }
        setMonitors(setup, [{ ...mineWithoutQueue(), enabled: false }, boardMonitor], [board])
        const moved = issue(5, {
            updated_on: '2026-09-28T14:45:00Z',
            status: { id: 2, name: 'Em andamento', is_closed: false }
        })
        setup.state.snapshots.set('board:b1', { count: 1, ids: [5] })
        setup.gateway.byFilter.set(JSON.stringify({ assignedTo: 'me', status: [1, 2], sort: 'priority' }), [moved])
        setup.gateway.details.set(
            5,
            detail(moved, {
                journals: [
                    {
                        id: 21,
                        user: LUCAS,
                        created_on: '2026-09-28T14:45:00Z',
                        details: [{ property: 'attr', name: 'status_id', old_value: '1', new_value: '2' }]
                    }
                ]
            })
        )

        await setup.monitor.runNow()

        expect(setup.notifier.shown.map((notification) => notification.payload)).toEqual([
            expect.objectContaining({
                type: 'issueChanged',
                changes: [{ type: 'columnChanged', from: 'To do', to: 'Doing' }]
            })
        ])
        expect(setup.log.entries.some((entry) => entry.type === 'monitor' && entry.event === 'cycleFinished')).toBe(
            true
        )
    })

    it('disabling a monitor drops its snapshot, so switching it back on does not flood', async () => {
        const setup = monitorSetup()
        setup.state.watermark = SINCE
        setup.state.snapshots.set('q1', { count: 3, ids: [1, 2, 3] })
        const queryMonitor: Monitor = {
            id: 'q1',
            name: 'Q',
            enabled: false,
            source: { type: 'query', queryId: 71 },
            events: defaultEvents('query')
        }
        setMonitors(setup, [mineWithoutQueue(), queryMonitor])
        await setup.monitor.runNow()
        expect(setup.state.snapshots.has('q1')).toBe(false)
    })

    it('after waking up, the next check is brought forward', () => {
        const delays: number[] = []
        const setup = monitorSetup()
        const monitor = new MonitorService({
            ...setup,
            scheduler: {
                after: (ms) => {
                    delays.push(ms)
                    return () => {}
                },
                every: () => () => {}
            }
        })
        monitor.start()
        monitor.checkAfterWake()
        expect(delays).toEqual([1000, 10000])
    })

    it('pauses without credentials', async () => {
        const setup = monitorSetup()
        setup.secrets.key = null
        await setup.monitor.runNow()
        expect(setup.monitor.getStatus().paused).toBe('no-credentials')
    })
})

describe('LoginUseCase', () => {
    const loginSetup = () => {
        const setup = monitorSetup()
        return { ...setup, login: new LoginUseCase(setup.gateway, setup.settings, setup.secrets, setup.monitor) }
    }
    it('adds https:// and drops a pasted page from the address', async () => {
        const view = await loginSetup().login.execute(' r.test/my/account ', 'key')
        expect(view.baseUrl).toBe('https://r.test')
    })
    it('rejects an address that is not http or https', async () =>
        expect(loginSetup().login.execute('ftp://r.test', 'key')).rejects.toMatchObject({ code: 'auth.invalidUrl' }))
    it('explains a missing /my/account as "not a Redmine"', async () => {
        const setup = loginSetup()
        setup.gateway.currentUser = async () => {
            throw new AppError('redmine.notFound', {}, 404)
        }
        await expect(setup.login.execute('https://r.test', 'key')).rejects.toMatchObject({
            code: 'auth.notRedmine',
            status: 404
        })
    })
    it('translates 401 into an invalid API key', async () =>
        expect(loginSetup().login.execute('https://r.test', 'wrong')).rejects.toMatchObject({
            code: 'auth.invalidKey'
        }))
    it('refuses a key with pasted spaces or line breaks before sending it anywhere', async () =>
        expect(loginSetup().login.execute('https://r.test', 'key with space')).rejects.toMatchObject({
            code: 'auth.invalidKey'
        }))
    it('stores the session', async () => {
        const setup = loginSetup()
        const view = await setup.login.execute('https://r.test/', 'key')
        expect(view).toMatchObject({ baseUrl: 'https://r.test', hasApiKey: true, user: { login: 'marina.costa' } })
    })
})

describe('boards', () => {
    it('moves the card to the column status that is allowed', async () => {
        const settings = new MemorySettings()
        const gateway = new FakeGateway()
        new SaveBoardUseCase(settings, new MemorySecrets(), noop).execute({
            id: 'b',
            name: 'Q',
            source: { type: 'mine' },
            swimlanes: 'none',
            columns: [{ id: 'doing', name: 'Doing', statusIds: [2, 8] }]
        })
        gateway.allowed.set(10, [{ id: 8, name: 'Em pausa', is_closed: false }])
        const status = await new MoveIssueToColumnUseCase(gateway, settings).execute('b', 10, 'doing')
        expect(status.id).toBe(8)
        expect(gateway.updates).toEqual([{ id: 10, update: { statusId: 8 } }])
    })

    it('switching board notifications on creates its monitor; deleting the board removes it', () => {
        const settings = new MemorySettings()
        let restarts = 0
        const restart = () => restarts++
        const board: Board = {
            id: 'b',
            name: 'Team',
            source: { type: 'mine' },
            swimlanes: 'none',
            columns: [{ id: 'c', name: 'C', statusIds: [1] }]
        }
        new SaveBoardUseCase(settings, new MemorySecrets(), restart).execute(board, {
            enabled: true,
            events: defaultEvents('board')
        })
        expect(settings.value.monitors.map((monitor) => [monitor.id, monitor.name])).toEqual([
            ['mine', ''],
            ['board:b', 'Team']
        ])
        new DeleteBoardUseCase(settings, new MemorySecrets(), restart).execute('b')
        expect(settings.value.monitors.map((monitor) => monitor.id)).toEqual(['mine'])
        expect(restarts).toBe(2)
    })

    it('does not save an invalid board', () => {
        expect(() =>
            new SaveBoardUseCase(new MemorySettings(), new MemorySecrets(), noop).execute({
                id: 'b',
                name: '',
                source: { type: 'mine' },
                swimlanes: 'none',
                columns: []
            })
        ).toThrow(AppError)
    })
})

describe('calendar', () => {
    it('new event gets an id and requires a title', () => {
        const repo = new MemoryCalendar()
        const useCase = new SaveCalendarEventUseCase(repo, new SeqIds(), new FixedClock(new Date()))
        const draft = {
            id: 'draft',
            title: ' Daily ',
            color: 'peacock' as const,
            allDay: false,
            start: '2026-09-28T09:00',
            end: '2026-09-28T09:15',
            reminders: [],
            createdAt: '',
            updatedAt: ''
        }
        expect(() => useCase.execute({ draft: { ...draft, title: ' ' }, isNew: true, scope: 'all' })).toThrow(
            'calendar.titleRequired'
        )
        expect(useCase.execute({ draft, isNew: true, scope: 'all' })).toMatchObject([{ id: 'id1', title: 'Daily' }])
    })

    it('fires reminders only once', () => {
        const calendar = new MemoryCalendar()
        calendar.events = [
            {
                id: 'e',
                title: 'Meeting',
                color: 'peacock',
                allDay: false,
                start: '2026-09-28T12:25',
                end: '2026-09-28T12:55',
                reminders: [5],
                createdAt: '',
                updatedAt: ''
            }
        ]
        const deps = {
            calendar,
            settings: new MemorySettings(),
            notifications: new MemoryNotifications(),
            notifier: new FakeNotifier(),
            events: new FakeEvents(),
            clock: new FixedClock(new Date(2026, 8, 28, 12, 20, 15)),
            ids: new SeqIds(),
            scheduler: noScheduler
        }
        const dispatcher = new ReminderDispatcher(deps)
        expect(dispatcher.tick()).toHaveLength(1)
        expect(dispatcher.tick()).toHaveLength(0)
        expect(deps.notifications.items[0].target).toEqual({
            type: 'route',
            route: '/calendar?date=2026-09-28&event=e'
        })
    })
})

describe('issues', () => {
    it('quick search: a number opens that issue; an issue the user cannot see is just no result', async () => {
        const gateway = new FakeGateway()
        gateway.details.set(7, detail(issue(7)))
        const queries = new IssueQueries(gateway)
        expect((await queries.search('#7')).map((found) => found.id)).toEqual([7])
        expect(await queries.search('#8')).toEqual([])
        expect(await queries.search('x')).toEqual([])
    })

    it('quick search by text sends the title filter', async () => {
        const gateway = new FakeGateway()
        await new IssueQueries(gateway).search('cupom')
        expect(gateway.filters.at(-1)?.rawQuery).toContain('v%5Bsubject%5D%5B%5D=cupom')
    })

    it('editing validates, saves and reports the fields Redmine ignored', async () => {
        const gateway = new FakeGateway()
        const current = detail(issue(10, { start_date: '2026-10-01', due_date: '2026-10-10' }))
        gateway.details.set(10, current)
        const editIssue = new EditIssueFieldsUseCase(gateway)

        await expect(editIssue.execute(10, { startDate: '2026-11-01' })).rejects.toMatchObject({
            code: 'issue.datesOrder'
        })
        expect(gateway.updates).toEqual([])

        const result = await editIssue.execute(10, { doneRatio: 40 })
        expect(gateway.updates).toEqual([{ id: 10, update: { doneRatio: 40 } }])
        expect(result.ignored).toEqual(['doneRatio'])
    })

    it('the title is saved without surrounding spaces', async () => {
        const gateway = new FakeGateway()
        gateway.details.set(10, detail(issue(10)))
        await new EditIssueFieldsUseCase(gateway).execute(10, { subject: '  Frete grátis  ' })
        expect(gateway.updates).toEqual([{ id: 10, update: { subject: 'Frete grátis' } }])
    })

    it('creating validates before calling Redmine and sends the trimmed title', async () => {
        const gateway = new FakeGateway()
        const createIssue = new CreateIssueUseCase(gateway)

        await expect(createIssue.execute({ projectId: 10, subject: '  ' })).rejects.toMatchObject({
            code: 'issue.subjectRequired'
        })
        expect(gateway.created).toEqual([])

        const created = await createIssue.execute({ projectId: 10, trackerId: 2, subject: ' Cupom duplicado ' })
        expect(gateway.created).toEqual([{ projectId: 10, trackerId: 2, subject: 'Cupom duplicado' }])
        expect(created.id).toBe(5001)
    })

    it('files go to Redmine first and are attached by token; nothing is sent when one is too large', async () => {
        const gateway = new FakeGateway()
        const createIssue = new CreateIssueUseCase(gateway)
        const tooLarge = { filename: 'video.mp4', bytes: new Uint8Array(21 * 1024 * 1024) }
        await expect(createIssue.execute({ projectId: 10, subject: 'Bug' }, [tooLarge])).rejects.toMatchObject({
            code: 'issue.uploadTooLarge'
        })
        expect([gateway.sentFiles, gateway.created]).toEqual([[], []])

        const print = { filename: 'C:\\prints\\tela.png', contentType: 'image/png', bytes: new Uint8Array([1, 2]) }
        await createIssue.execute({ projectId: 10, subject: 'Bug' }, [print])
        expect(gateway.sentFiles.map((file) => file.filename)).toEqual(['tela.png'])
        expect(gateway.attachedUploads[0]).toEqual([
            { token: 'token-1', filename: 'tela.png', contentType: 'image/png' }
        ])
    })

    it('edit options bring the project trackers, people by name and only the versions not closed', async () => {
        const gateway = new FakeGateway()
        gateway.members = [
            { id: 2, name: 'Lucas' },
            { id: 1, name: 'Beatriz' }
        ]
        gateway.versions = [
            { id: 1, name: '3.77', status: 'closed' },
            { id: 2, name: '3.78', status: 'open' }
        ] as Version[]
        const options = await new IssueQueries(gateway).editOptions(10)
        expect(options.trackers.map((tracker) => tracker.name)).toEqual(['Desenvolvimento', 'Defeito'])
        expect(options.assignees.map((person) => person.name)).toEqual(['Beatriz', 'Lucas'])
        expect(options.versions.map((version) => version.name)).toEqual(['3.78'])
    })
})
