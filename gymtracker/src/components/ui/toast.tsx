'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

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
            {/* Toast container */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
              px-4 py-3 rounded-xl text-sm font-medium shadow-lg pointer-events-auto
              animate-[slideDown_0.3s_ease-out]
              ${toast.type === 'success' ? 'bg-emerald-600/90 text-zinc-900 dark:text-white' : ''}
              ${toast.type === 'error' ? 'bg-red-600/90 text-zinc-900 dark:text-white' : ''}
              ${toast.type === 'info' ? 'bg-zinc-700/90 text-zinc-900 dark:text-white' : ''}
            `}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
