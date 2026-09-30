export function snippet(text: string, max = 120): string {
    const flat = text.replace(/\s+/g, ' ').trim()
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

export function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function safeRegex(pattern: string, fallback: RegExp): RegExp {
    try {
        return new RegExp(pattern)
    } catch {
        return fallback
    }
}

/** Lowercase without accents, so "configuracoes" finds "Configurações". */
export function foldForSearch(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
}
