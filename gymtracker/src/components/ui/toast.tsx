'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
    id: number
    message: string
    type: ToastType
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({
    showToast: () => { },
})

export function useToast() {
    return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const idRef = useRef(0)

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = ++idRef.current
        setToasts((prev) => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 3000)
    }, [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
              app-panel px-4 py-3 text-sm font-medium pointer-events-auto
              animate-[slideDown_0.3s_ease-out]
              ${toast.type === 'success' ? 'border-emerald-500/25 bg-emerald-500/14 text-emerald-700 dark:text-emerald-300' : ''}
              ${toast.type === 'error' ? 'border-red-500/25 bg-red-500/14 text-red-700 dark:text-red-300' : ''}
              ${toast.type === 'info' ? 'border-violet-500/20 bg-violet-500/12 text-violet-700 dark:text-violet-300' : ''}
            `}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
