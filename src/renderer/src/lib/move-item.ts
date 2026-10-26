/** Copy of `items` with the item at `index` moved by `delta` places (negative moves it up). */
export function moveItem<T>(items: T[], index: number, delta: number): T[] {
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(index + delta, 0, moved)
    return next
}
