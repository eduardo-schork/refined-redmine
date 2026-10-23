import type { Named } from './entities'
import type { IssueStyleRules } from './issue-style'

// Tracker names, in Portuguese or English; checked in order, the first match wins ("Melhoria de bug" is a bug).
const TRACKER_PATTERNS: [RegExp, string][] = [
    [/bug|defeito|erro|falha|incident|hotfix|corre[cç]/i, '#d14343'],
    [/melhoria|improve|enhance|evolu|refator|refactor/i, '#0d9488'],
    [/feature|funcionalidade|recurso|novo|nova|hist[oó]ria|story/i, '#2f6fdb'],
    [/suporte|support|d[uú]vida|question|atendimento/i, '#8b5cf6'],
    [/doc/i, '#c27c0e'],
    [/tarefa|task|atividade|chore/i, '#7b8494']
]

// Trackers with an unknown name still get distinct colors, picked by id so they never change between sessions.
const FALLBACK_COLORS = ['#db2777', '#0891b2', '#65a30d', '#9333ea', '#ea580c', '#475569']

export function inferredTrackerColor(tracker: Named): string {
    const match = TRACKER_PATTERNS.find(([pattern]) => pattern.test(tracker.name))
    if (match) return match[1]
    return FALLBACK_COLORS[Math.abs(tracker.id) % FALLBACK_COLORS.length]
}

/** Hex color of a tracker: the user's choice wins over the inference from the name. */
export function trackerColor(tracker: Named, rules?: IssueStyleRules): string {
    return rules?.trackerColors[tracker.id] ?? inferredTrackerColor(tracker)
}
