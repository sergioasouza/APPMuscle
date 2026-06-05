'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

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
    confirmLabel,
    cancelLabel,
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const t = useTranslations('Common')
    const [loading, setLoading] = useState(false)
    const titleId = useId()
    const descriptionId = useId()
    const panelRef = useRef<HTMLDivElement>(null)
    const lastFocusedElementRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        if (!open) {
            return
        }

        lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null

        const focusableSelector = [
            'button:not([disabled])',
            '[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(',')

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !loading) {
                onCancel()
                return
            }

            if (event.key !== 'Tab' || !panelRef.current) {
                return
            }

            const focusableElements = Array.from(
                panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
            )

            if (focusableElements.length === 0) {
                return
            }

            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault()
                lastElement.focus()
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault()
                firstElement.focus()
            }
        }

        window.setTimeout(() => {
            panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus()
        }, 0)

        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            lastFocusedElementRef.current?.focus()
        }
    }, [loading, onCancel, open])

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
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            <Surface
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="relative w-full max-w-sm animate-[slideUp_0.2s_ease-out] p-6"
            >
                <h3 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
                <p id={descriptionId} className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">{description}</p>

                <div className="flex gap-3 mt-6">
                    <Button
                        onClick={onCancel}
                        disabled={loading}
                        variant="secondary"
                        className="flex-1"
                    >
                        {cancelLabel ?? t('cancel')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading}
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        className="flex-1"
                    >
                        {loading ? t('loading') : (confirmLabel ?? t('confirm'))}
                    </Button>
                </div>
            </Surface>
        </div>
    )
}
