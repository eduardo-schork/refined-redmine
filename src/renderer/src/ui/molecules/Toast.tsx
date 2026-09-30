import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'error'
interface ToastItem {
    id: number
    message: string
    tone: Tone
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([])
    const push = useCallback((message: string, tone: Tone = 'info') => {
        const id = Date.now() + Math.random()
        const dismiss = () => setItems((current) => current.filter((item) => item.id !== id))
        setItems((current) => [...current, { id, message, tone }])
        setTimeout(dismiss, 5000)
    }, [])
    return (
        <ToastContext.Provider value={push}>
            {children}
            <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" role="status">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={cn(
                            'rounded-lg border bg-panel px-3 py-2 text-sm shadow-lg',
                            item.tone === 'error' ? 'border-danger/40 text-danger' : 'border-line'
                        )}
                    >
                        {item.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export const useToast = () => useContext(ToastContext)
