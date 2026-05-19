'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'
import Link from 'next/link'

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
} as const

const btn = {
    solid: 'cursor-pointer transition hover:brightness-90 active:brightness-75 disabled:hover:brightness-100 disabled:active:brightness-100',
    surface: 'cursor-pointer transition hover:brightness-95 active:brightness-90 disabled:hover:brightness-100 disabled:active:brightness-100',
} as const

export default function NewSessionPage() {
    const router = useRouter()

    const [title, setTitle] = useState('')
    const [opensAt, setOpensAt] = useState('')
    const [closesAt, setClosesAt] = useState('')
    const [perPersonLimit, setPerPersonLimit] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await adminFetch('/api/admin/sessions', {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    opensAt: opensAt ? new Date(opensAt).toISOString() : null,
                    closesAt: closesAt ? new Date(closesAt).toISOString() : null,
                    perPersonLimit: perPersonLimit ? Number(perPersonLimit) : null,
                }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '建立失敗')
            router.push(`/admin/sessions/${body.data.sessionId}`)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-lg mx-auto">

            {/* 頁首 */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/admin/sessions"
                    className={`text-sm px-3 py-1.5 rounded-lg border ${btn.surface}`}
                    style={css.surface}>
                    <span style={css.muted}>← 返回</span>
                </Link>
                <h1 className="text-xl font-semibold" style={css.text}>新增開單</h1>
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
                            placeholder="例：4月甜點預購"
                            className="w-full border rounded-lg px-2 py-2 text-xs"
                            style={css.surface}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-medium" style={css.muted}>開放時間（選填）</label>
                            {opensAt && <button type="button" onClick={() => setOpensAt('')} className="text-xs cursor-pointer" style={css.muted}>清除</button>}
                        </div>
                        <input
                            type="datetime-local"
                            value={opensAt}
                            onChange={e => setOpensAt(e.target.value)}
                            className="w-full max-w-full border rounded-lg px-2 py-2 text-xs"
                            style={css.surface}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-medium" style={css.muted}>截止時間（選填）</label>
                            {closesAt && <button type="button" onClick={() => setClosesAt('')} className="text-xs cursor-pointer" style={css.muted}>清除</button>}
                        </div>
                        <input
                            type="datetime-local"
                            value={closesAt}
                            onChange={e => setClosesAt(e.target.value)}
                            className="w-full max-w-full border rounded-lg px-2 py-2 text-xs"
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
                            className="w-full border rounded-lg px-2 py-2 text-xs"
                            style={css.surface}
                        />
                    </div>

                    {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${btn.solid}`}
                        style={{ backgroundColor: 'var(--color-admin-primary)' }}
                    >
                        {loading ? '建立中...' : '建立開單'}
                    </button>
                </form>
            </div>
        </div>
    )
}
