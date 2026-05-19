'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Props = {
    value: string       // 'YYYY-MM-DD' or ''
    onChange: (v: string) => void
    placeholder?: string
}

function formatDisplay(value: string): string {
    if (!value) return ''
    const d = new Date(value + 'T00:00:00')
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function DatePicker({ value, onChange, placeholder }: Props) {
    const [open, setOpen] = useState(false)
    const selected = value ? new Date(value + 'T00:00:00') : undefined

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                className="w-full text-left border rounded-lg px-2 py-2 text-xs"
                style={{
                    backgroundColor: 'var(--color-admin-surface)',
                    borderColor: 'var(--color-admin-border)',
                    color: value ? 'var(--color-admin-text)' : 'var(--color-admin-muted)',
                }}
            >
                {value ? formatDisplay(value) : (placeholder ?? '選擇日期')}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={date => {
                        if (date) {
                            const y = date.getFullYear()
                            const m = String(date.getMonth() + 1).padStart(2, '0')
                            const d = String(date.getDate()).padStart(2, '0')
                            onChange(`${y}-${m}-${d}`)
                        }
                        setOpen(false)
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}
