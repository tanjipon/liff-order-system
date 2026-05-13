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

export default function NewRolePage() {
    const router = useRouter()

    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await adminFetch('/api/admin/roles', {
                method: 'POST',
                body: JSON.stringify({ name }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '新增失敗')
            router.push('/admin/roles')
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
                <Link href="/admin/roles"
                    className={`text-sm px-3 py-1.5 rounded-lg border ${btn.surface}`}
                    style={css.surface}>
                    <span style={css.muted}>← 返回</span>
                </Link>
                <h1 className="text-xl font-semibold" style={css.text}>新增角色</h1>
            </div>

            <div className="rounded-xl border p-6" style={css.surface}>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>角色名稱 *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            placeholder="例：baker"
                            className="w-full border rounded-lg px-3 py-2 text-sm"
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
                        {loading ? '新增中...' : '新增角色'}
                    </button>
                </form>
            </div>
        </div>
    )
}
