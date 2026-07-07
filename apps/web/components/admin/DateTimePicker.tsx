'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Props = {
    value: string       // 'YYYY-MM-DDTHH:mm' or ''
    onChange: (v: string) => void
    required?: boolean
}

function parseValue(value: string) {
    if (!value) return { date: undefined, time: '00:00' }
    const d = new Date(value)
    if (isNaN(d.getTime())) return { date: undefined, time: '00:00' }
    return {
        date: d,
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    }
}

function toLocalIso(date: Date, time: string): string {
    const [h, m] = time.split(':')
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${h}:${m}`
}

function formatDisplay(value: string): string {
    if (!value) return ''
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DateTimePicker({ value, onChange, required }: Props) {
    const [open, setOpen] = useState(false)
    const { date: selected, time } = parseValue(value)

    function handleDateSelect(date: Date | undefined) {
        if (!date) return
        onChange(toLocalIso(date, time))
    }

    function handleTimeChange(newTime: string) {
        if (selected) {
            onChange(toLocalIso(selected, newTime))
        } else {
            // date not yet picked, store time for later
            const today = new Date()
            onChange(toLocalIso(today, newTime))
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                className="admin-picker-trigger w-full text-left border rounded-lg px-3 text-xs h-9 flex items-center"
                style={{
                    backgroundColor: 'var(--color-admin-surface)',
                    borderColor: 'var(--color-admin-border)',
                    color: value ? 'var(--color-admin-text)' : 'var(--color-admin-muted)',
                }}
            >
                {value ? formatDisplay(value) : '選擇日期時間'}
                {required && !value && <span aria-hidden> *</span>}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={handleDateSelect}
                />
                <div className="border-t px-3 py-2 flex items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0">時間</label>
                    <input
                        type="time"
                        value={time}
                        onChange={e => handleTimeChange(e.target.value)}
                        className="flex-1 border rounded px-2 py-1 text-xs"
                        style={{ fontSize: '16px' }}
                    />
                </div>
            </PopoverContent>
        </Popover>
    )
}
