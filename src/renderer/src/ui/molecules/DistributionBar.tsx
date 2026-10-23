import { cn } from '@/lib/cn'

export interface DistributionSegment {
    key: string
    label: string
    count: number
    /** Background class of the segment and of its legend dot. */
    colorClass: string
    /** CSS color that replaces the class (a color the user picked). */
    color?: string
}

const segmentStyle = (segment: DistributionSegment) => (segment.color ? { backgroundColor: segment.color } : {})
const segmentClass = (segment: DistributionSegment) => (segment.color ? undefined : segment.colorClass)

const percentOf = (count: number, total: number) => (total ? Math.round((count / total) * 100) : 0)

/** Stacked horizontal bar with a legend: how a total splits into parts (statuses, types…). */
export function DistributionBar({ segments }: { segments: DistributionSegment[] }) {
    const total = segments.reduce((sum, segment) => sum + segment.count, 0)
    return (
        <div className="flex flex-col gap-3">
            <div className="flex h-4 overflow-hidden rounded-full bg-panel-2">
                {segments.map((segment) => (
                    <div
                        key={segment.key}
                        title={`${segment.label}: ${segment.count}`}
                        className={cn('h-full border-r-2 border-panel last:border-r-0', segmentClass(segment))}
                        style={{ ...segmentStyle(segment), width: `${(segment.count / Math.max(total, 1)) * 100}%` }}
                    />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
                {segments.map((segment) => (
                    <span key={segment.key} className="flex items-center gap-1.5 text-sm">
                        <span
                            className={cn('h-2.5 w-2.5 rounded-full', segmentClass(segment))}
                            style={segmentStyle(segment)}
                        />
                        <span>{segment.label}</span>
                        <span className="font-semibold tabular-nums">{segment.count}</span>
                        <span className="text-xs text-muted">{percentOf(segment.count, total)}%</span>
                    </span>
                ))}
            </div>
        </div>
    )
}

/** One row per item with a bar proportional to the largest one. */
export function RankedBars({ items }: { items: { name: string; count: number; colorClass?: string }[] }) {
    const largest = Math.max(1, ...items.map((item) => item.count))
    return (
        <div className="flex flex-col gap-2">
            {items.map((item) => (
                <div key={item.name} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3 text-sm">
                    <span className="truncate">{item.name}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                        <div
                            className={cn('h-full rounded-full', item.colorClass ?? 'bg-accent/70')}
                            style={{ width: `${(item.count / largest) * 100}%` }}
                        />
                    </div>
                    <span className="text-right font-semibold tabular-nums">{item.count}</span>
                </div>
            ))}
        </div>
    )
}
