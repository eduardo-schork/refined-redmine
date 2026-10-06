import type { LocalDate, LocalDateTime } from '../shared/date'

export type NotificationKind =
    'new_issue' | 'assigned' | 'status' | 'comment' | 'mention' | 'updated' | 'unqueued' | 'query' | 'reminder'

export interface IssueRef {
    id: number
    subject: string
    tracker?: string
    project?: string
}

/** A change observed in a Redmine journal. */
export type IssueChange =
    | { type: 'assignedToYou' }
    | { type: 'assigneeChanged' }
    | { type: 'statusChanged'; from: string; to: string }
    | { type: 'columnChanged'; from: string; to: string }
    | { type: 'fieldChanged'; field: string }
    | { type: 'attachmentAdded' }
    | { type: 'commented'; excerpt: string }
    | { type: 'mentioned'; excerpt: string }

export type QueueExitReason =
    | { type: 'reassigned'; to?: string }
    | { type: 'closed'; status: string }
    | { type: 'nowWith'; name?: string }
    | { type: 'status'; status: string }

/**
 * Structured content (no ready-made text): the text is generated in the user's language when displayed.
 * `legacy` preserves old notifications, stored when the content was still text.
 */
export type NotificationPayload =
    | { type: 'issueCreated'; issue: IssueRef; actor: string; assignedToYou: boolean }
    | { type: 'issueChanged'; issue: IssueRef; actor: string; changes: IssueChange[] }
    | { type: 'queueExit'; issue: IssueRef; actor?: string; reasons: QueueExitReason[]; excerpt?: string }
    | { type: 'queueExitHidden'; issueId: number }
    | {
          type: 'queryChanged'
          queryName: string
          from: number
          to: number
          added: IssueRef[]
          removed?: IssueRef[]
      }
    | {
          type: 'reminder'
          eventId: string
          occurrenceKey: LocalDate
          title: string
          start: LocalDateTime
          end: LocalDateTime
          allDay: boolean
          location?: string
          minutes: number
      }
    | { type: 'legacy'; title: string; body: string }

/** Where the click leads. */
export type NotificationTarget = { type: 'url'; url: string } | { type: 'route'; route: string }

/** Monitor that produced the notification (several when two monitors saw the same change). */
export interface NotificationSource {
    monitorId: string
    name: string
}

/** An item of the notification history. */
export interface AppNotification {
    id: string
    kind: NotificationKind
    payload: NotificationPayload
    issueId?: number
    target: NotificationTarget
    createdAt: string
    read: boolean
    sources?: NotificationSource[]
}

export const MAX_NOTIFICATIONS = 300

/** Above this, a cycle produces a single summarized system notification. */
export const SUMMARY_THRESHOLD = 4

export const shouldSummarize = (count: number) => count > SUMMARY_THRESHOLD

export const calendarRoute = (date: LocalDate, eventId: string) => `/calendar?date=${date}&event=${eventId}`

export const boardRoute = (boardId: string) => `/board?id=${encodeURIComponent(boardId)}`

/** Opens the issue's detail inside the app. */
export const issueRoute = (issueId: number) => `/issue?id=${issueId}`
