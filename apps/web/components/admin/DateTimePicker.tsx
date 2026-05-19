'use client'

import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const inputStyle = {
    width: '100%',
    border: '1px solid var(--color-admin-border)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.5rem',
    fontSize: '0.75rem',
    backgroundColor: 'var(--color-admin-surface)',
    color: 'var(--color-admin-text)',
    outline: 'none',
    boxSizing: 'border-box' as const,
}

type Props = {
    value: string       // ISO string or ''
    onChange: (v: string) => void
    required?: boolean
}

// Parse an ISO/local string to Date, return null if empty
function parseValue(value: string): Date | null {
    if (!value) return null
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
}

// Produce a local ISO-like string (YYYY-MM-DDTHH:mm) from a Date
function toLocalIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function DateTimePicker({ value, onChange, required }: Props) {
    const selected = parseValue(value)

    return (
        <ReactDatePicker
            selected={selected}
            onChange={(date: Date | null) => onChange(date ? toLocalIso(date) : '')}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="yyyy/MM/dd HH:mm"
            placeholderText="選擇日期時間"
            customInput={<input style={inputStyle} required={required} readOnly />}
            wrapperClassName="w-full"
            popperPlacement="bottom-start"
            isClearable={false}
        />
    )
}
