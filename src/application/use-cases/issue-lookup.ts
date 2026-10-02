import type { Issue } from '@domain/redmine/entities'
import type { RedmineGateway } from '../ports/redmine-gateway'

/** Issues by number in a single listing, in any status. Issues the user cannot see are left out by Redmine. */
export async function issuesByIds(gateway: RedmineGateway, ids: number[]): Promise<Issue[]> {
    const validIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
    if (!validIds.length) return []
    const rawQuery = new URLSearchParams({ issue_id: validIds.join(','), status_id: '*' }).toString()
    const page = await gateway.listIssues({ rawQuery }, validIds.length)
    return page.items
}
