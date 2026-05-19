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
    value: string       // 'YYYY-MM-DD' or ''
    onChange: (v: string) => void
    placeholder?: string
}

export default function DatePicker({ value, onChange, placeholder }: Props) {
    const selected = value ? new Date(value + 'T00:00:00') : null

    return (
        <ReactDatePicker
            selected={selected}
            onChange={(date: Date | null) => onChange(date ? date.toLocaleDateString('sv-SE') : '')}
            dateFormat="yyyy/MM/dd"
            placeholderText={placeholder ?? '選擇日期'}
            customInput={<input style={inputStyle} readOnly />}
            wrapperClassName="w-full"
            popperPlacement="bottom-start"
            isClearable={false}
        />
    )
}
