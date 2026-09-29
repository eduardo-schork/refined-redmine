import type { Relation } from './entities'

export type RelationType =
    | 'relates'
    | 'duplicates'
    | 'duplicated'
    | 'blocks'
    | 'blocked'
    | 'precedes'
    | 'follows'
    | 'copied_to'
    | 'copied_from'

const INVERSE: Record<string, RelationType> = {
    blocks: 'blocked',
    blocked: 'blocks',
    precedes: 'follows',
    follows: 'precedes',
    duplicates: 'duplicated',
    duplicated: 'duplicates',
    copied_to: 'copied_from',
    copied_from: 'copied_to'
}

/** The relation seen from `issueId`: Redmine returns the type from the point of view of `issue_id`. */
export function relationFrom(issueId: number, relation: Relation): { type: RelationType; otherId: number } {
    const type = relation.relation_type as RelationType
    if (relation.issue_id === issueId) return { type, otherId: relation.issue_to_id }
    const inverseType = INVERSE[relation.relation_type] ?? type
    return { type: inverseType, otherId: relation.issue_id }
}
