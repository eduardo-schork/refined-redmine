import { useEffect, useState } from 'react'

/** The current time, refreshed every `intervalMs` while `active` (a running stopwatch). */
export function useNow(intervalMs: number, active: boolean): Date {
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        setNow(new Date())
        if (!active) return
        const timer = setInterval(() => setNow(new Date()), intervalMs)
        return () => clearInterval(timer)
    }, [intervalMs, active])
    return now
}
