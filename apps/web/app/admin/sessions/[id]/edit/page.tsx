'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import Link from 'next/link'

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
} as const

export default function EditSessionPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [title, setTitle] = useState('')
    const [opensAt, setOpensAt] = useState('')
    const [closesAt, setClosesAt] = useState('')
    const [perPersonLimit, setPerPersonLimit] = useState('')
    const [isActive, setIsActive] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toggling, setToggling] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        adminFetch(`/api/admin/sessions/${id}`)
            .then(r => r.json())
            .then(body => {
                const s = body.data
                setTitle(s.title)
                setOpensAt(s.opens_at ? toDatetimeLocal(s.opens_at) : '')
                setClosesAt(s.closes_at ? toDatetimeLocal(s.closes_at) : '')
                setPerPersonLimit(s.per_person_limit ? String(s.per_person_limit) : '')
                setIsActive(s.is_active)
            })
            .finally(() => setLoading(false))
    }, [])

    async function handleToggle() {
        setToggling(true)
        try {
            await adminFetch(`/api/admin/sessions/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ isActive: !isActive }),
            })
            setIsActive(prev => !prev)
        } finally {
            setToggling(false)
        }
    }

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault()
        setSaving(true)
        setError(null)
        try {
            const res = await adminFetch(`/api/admin/sessions/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    title,
                    opensAt: opensAt ? toISO(opensAt) : null,
                    closesAt: closesAt ? toISO(closesAt) : null,
                    perPersonLimit: perPersonLimit ? Number(perPersonLimit) : null,
                }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '儲存失敗')
            router.push(`/admin/sessions/${id}`)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <AdminSpinner />

    return (
        <div className="p-6 max-w-lg mx-auto">

            {/* 頁首 */}
            <div className="flex items-center gap-3 mb-6">
                <Link href={`/admin/sessions/${id}`}
                    className="text-sm px-3 py-1.5 rounded-lg border"
                    style={css.surface}>
                    <span style={css.muted}>← 返回</span>
                </Link>
                <h1 className="text-xl font-semibold" style={css.text}>編輯開單</h1>
            </div>

            <div className="rounded-xl border p-6" style={css.surface}>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>開單名稱 *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>開放時間（選填）</label>
                        <input
                            type="datetime-local"
                            value={opensAt}
                            onChange={e => setOpensAt(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>截止時間（選填）</label>
                        <input
                            type="datetime-local"
                            value={closesAt}
                            onChange={e => setClosesAt(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>每人上限（選填）</label>
                        <input
                            type="number"
                            min="1"
                            value={perPersonLimit}
                            onChange={e => setPerPersonLimit(e.target.value)}
                            placeholder="不填表示無限制"
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        />
                    </div>

                    {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-admin-primary)' }}
                    >
                        {saving ? '儲存中...' : '儲存'}
                    </button>
                </form>
            </div>

            {/* 啟用 / 停用 */}
            <div className="rounded-xl border p-5 mt-4" style={css.surface}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold" style={css.text}>
                            開單狀態：
                            <span className="ml-1.5 font-semibold"
                                style={{ color: isActive ? '#16A34A' : '#6B7280' }}>
                                {isActive ? '啟用中' : '已停用'}
                            </span>
                        </p>
                        <p className="text-xs mt-0.5" style={css.muted}>
                            {isActive ? '客戶目前可以看到此開單並下訂單' : '客戶目前無法看到此開單'}
                        </p>
                    </div>
                    <button
                        onClick={handleToggle}
                        disabled={toggling}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 shrink-0"
                        style={isActive
                            ? { backgroundColor: '#FEE2E2', color: '#991B1B' }
                            : { backgroundColor: '#DCFCE7', color: '#166534' }}
                    >
                        {toggling ? '處理中...' : isActive ? '停用' : '啟用'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Convert UTC ISO from DB to local time for datetime-local input
function toDatetimeLocal(iso: string): string {
    const d = new Date(iso)
    const offset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}

// Convert datetime-local value (treated as local time) to UTC ISO for DB
function toISO(datetimeLocal: string): string {
    return new Date(datetimeLocal).toISOString()
}
