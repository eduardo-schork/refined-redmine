import type { EventColor } from './calendar-event'

/** Google Calendar palette. The display name comes from i18n (`calendar.colors.<key>`). */
export const EVENT_COLORS: { key: EventColor; hex: string; darkText?: boolean }[] = [
    { key: 'tomato', hex: '#D50000' },
    { key: 'flamingo', hex: '#E67C73' },
    { key: 'tangerine', hex: '#F4511E' },
    { key: 'banana', hex: '#F6BF26', darkText: true },
    { key: 'sage', hex: '#33B679' },
    { key: 'basil', hex: '#0B8043' },
    { key: 'peacock', hex: '#039BE5' },
    { key: 'blueberry', hex: '#3F51B5' },
    { key: 'lavender', hex: '#7986CB' },
    { key: 'grape', hex: '#8E24AA' },
    { key: 'graphite', hex: '#616161' }
]

export const DEFAULT_EVENT_COLOR: EventColor = 'peacock'

const FALLBACK_COLOR = EVENT_COLORS[6]

export const colorOf = (key: EventColor) => EVENT_COLORS.find((color) => color.key === key) ?? FALLBACK_COLOR
