import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '@domain/time/time-entry'
import { TimerService } from './services/timer-service'
import { FakeEvents, FakeGateway, FixedClock, MemoryTimer } from './testing/fakes'
import { LogTimeUseCase, RepeatWeekUseCase, TimeQueries } from './use-cases/time'

const entry = (id: number, issueId: number | undefined, spentOn: string, comments = 'Trabalho'): TimeEntry => ({
    id,
    project: { id: 10, name: 'Loja' },
    issue: issueId ? { id: issueId } : undefined,
    user: { id: 42, name: 'Marina' },
    activity: { id: 9, name: 'Desenvolvimento' },
    hours: 2,
    comments,
    spent_on: spentOn,
    created_on: '',
    updated_on: ''
})

describe('time entries', () => {
    it('validates before logging and trims the comment', async () => {
        const gateway = new FakeGateway()
        const log = new LogTimeUseCase(gateway)
        await expect(
            log.execute({ issueId: 1201, spentOn: '2026-09-30', hours: 1, comments: ' ' })
        ).rejects.toMatchObject({ code: 'time.comment' })
        await log.execute({ issueId: 1201, spentOn: '2026-09-30', hours: 1.5, comments: ' Revisão ' })
        expect(gateway.createdTimeEntries).toEqual([
            { issueId: 1201, spentOn: '2026-09-30', hours: 1.5, comments: 'Revisão' }
        ])
    })

    it('lists the week newest first, with the titles of the issues', async () => {
        const gateway = new FakeGateway()
        gateway.issues = [{ id: 1201, subject: 'CEP no checkout' } as never]
        gateway.timeEntries = [entry(1, 1201, '2026-09-28'), entry(2, 1201, '2026-09-30'), entry(3, 1201, '2026-09-10')]
        const result = await new TimeQueries(gateway).mine('2026-09-28', '2026-10-04')
        expect(result.entries.map((item) => item.id)).toEqual([2, 1])
        expect(result.issues[1201].subject).toBe('CEP no checkout')
    })

    it('repeats last week on the same weekdays, skipping entries without an issue', async () => {
        const gateway = new FakeGateway()
        gateway.timeEntries = [entry(1, 1201, '2026-09-21', 'Daily'), entry(2, undefined, '2026-09-22')]
        const created = await new RepeatWeekUseCase(gateway).execute('2026-09-21', '2026-09-27')
        expect(created).toBe(1)
        expect(gateway.createdTimeEntries).toEqual([
            { issueId: 1201, spentOn: '2026-09-28', hours: 2, activityId: 9, comments: 'Daily' }
        ])
    })
})

describe('TimerService', () => {
    function setup(idleSeconds = 0) {
        const clock = new FixedClock(new Date('2026-10-01T12:00:00Z'))
        const events = new FakeEvents()
        const repository = new MemoryTimer()
        const service = new TimerService({
            repository,
            events,
            clock,
            scheduler: { after: () => () => {}, every: () => () => {} },
            idle: { idleSeconds: () => idleSeconds }
        })
        return { clock, events, repository, service }
    }

    it('starts, stops with the counted hours and keeps the stopwatch until it is logged or discarded', () => {
        const { clock, events, repository, service } = setup()
        service.begin({ id: 1201, subject: 'CEP' })
        clock.current = new Date('2026-10-01T13:30:00Z')
        expect(service.stop()).toMatchObject({ issueId: 1201, hours: 1.5 })
        expect(repository.value?.runningSince).toBeNull()
        service.discard()
        expect(repository.value).toBeNull()
        expect(events.timers.at(-1)).toBeNull()
    })

    it('does not count the time away after 10 idle minutes', () => {
        const { clock, repository, service } = setup(15 * 60)
        service.begin({ id: 1201, subject: 'CEP' })
        clock.current = new Date('2026-10-01T13:00:00Z')
        service.checkIdle()
        // Left 15 minutes before the check: 45 minutes counted.
        expect(repository.value).toMatchObject({ pausedReason: 'idle', accumulatedMs: 45 * 60_000 })
    })

    it('pauses when the computer sleeps', () => {
        const { clock, repository, service } = setup()
        service.begin({ id: 1201, subject: 'CEP' })
        clock.current = new Date('2026-10-01T12:20:00Z')
        service.onSleep()
        expect(repository.value).toMatchObject({ pausedReason: 'sleep', accumulatedMs: 20 * 60_000 })
    })
})
