'use client'

import { TW_CITIES, getDistricts } from '@/lib/twAddress'

export type AddressParts = {
    city: string
    district: string
    zip: string
    street: string
    detail: string
}

export const EMPTY_ADDRESS: AddressParts = { city: '', district: '', zip: '', street: '', detail: '' }

interface Props {
    value: AddressParts
    onChange: (parts: AddressParts) => void
    surfaceStyle: React.CSSProperties
}

export default function AddressInput({ value, onChange, surfaceStyle }: Props) {
    const inputClass = 'w-full border rounded-xl px-3 py-2 text-sm'
    const selectClass = 'w-full border rounded-xl px-3 py-2 text-sm bg-transparent appearance-none'

    function handleCityChange(city: string) {
        // Reset district and zip when city changes
        onChange({ ...value, city, district: '', zip: '' })
    }

    function handleDistrictChange(district: string) {
        const found = getDistricts(value.city).find(d => d.name === district)
        onChange({ ...value, district, zip: found?.zip ?? '' })
    }

    return (
        <div className="space-y-2">
            {/* 縣市 */}
            <select
                value={value.city}
                onChange={e => handleCityChange(e.target.value)}
                className={selectClass}
                style={surfaceStyle}
            >
                <option value="">選擇縣市</option>
                {TW_CITIES.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                ))}
            </select>

            {/* 鄉鎮區 + 郵遞區號 */}
            <div className="flex gap-2">
                <select
                    value={value.district}
                    onChange={e => handleDistrictChange(e.target.value)}
                    disabled={!value.city}
                    className={selectClass + ' flex-1'}
                    style={surfaceStyle}
                >
                    <option value="">選擇鄉鎮區</option>
                    {getDistricts(value.city).map(d => (
                        <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                </select>
                <input
                    readOnly
                    value={value.zip}
                    placeholder="郵遞區號"
                    className="w-24 border rounded-xl px-3 py-2 text-sm text-center shrink-0"
                    style={{ ...surfaceStyle, opacity: value.zip ? 1 : 0.4 }}
                    tabIndex={-1}
                />
            </div>

            {/* 路段 */}
            <input
                value={value.street}
                onChange={e => onChange({ ...value, street: e.target.value })}
                placeholder="路段（例：中山路一段）"
                className={inputClass}
                style={surfaceStyle}
            />

            {/* 巷弄門牌 */}
            <input
                value={value.detail}
                onChange={e => onChange({ ...value, detail: e.target.value })}
                placeholder="巷弄、門牌（例：12巷3號）"
                className={inputClass}
                style={surfaceStyle}
            />
        </div>
    )
}
