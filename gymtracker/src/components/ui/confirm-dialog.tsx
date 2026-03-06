'use client'

import { useState } from 'react'

interface ConfirmDialogProps {
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'default'
    onConfirm: () => void | Promise<void>
    onCancel: () => void
}

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const [loading, setLoading] = useState(false)

    if (!open) return null

    const handleConfirm = async () => {
        setLoading(true)
        try {
            await onConfirm()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6
        animate-[slideUp_0.2s_ease-out] shadow-2xl">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">{description}</p>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl
              hover:bg-zinc-700 transition-colors active:scale-[0.98]"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`flex-1 py-3 font-medium rounded-xl transition-colors active:scale-[0.98]
              disabled:opacity-50
              ${variant === 'danger'
                                ? 'bg-red-600 text-zinc-900 dark:text-white hover:bg-red-500'
                                : 'bg-violet-600 text-zinc-900 dark:text-white hover:bg-violet-500'
                            }`}
                    >
                        {loading ? 'Loading...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
