'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'
import Link from 'next/link'

type Role = {
    id: string
    name: string
}

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
} as const

const btn = {
    solid: 'cursor-pointer transition hover:brightness-90 active:brightness-75 disabled:hover:brightness-100 disabled:active:brightness-100',
    surface: 'cursor-pointer transition hover:brightness-95 active:brightness-90 disabled:hover:brightness-100 disabled:active:brightness-100',
} as const

export default function NewStaffPage() {
    const router = useRouter()

    const [displayName, setDisplayName] = useState('')
    const [email, setEmail] = useState('')
    const [roleId, setRoleId] = useState('')
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        adminFetch('/api/admin/roles')
            .then(r => r.json())
            .then(body => {
                setRoles(body.data ?? [])
                if (body.data?.length > 0) setRoleId(body.data[0].id)
            })
    }, [])

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await adminFetch('/api/admin/staff', {
                method: 'POST',
                body: JSON.stringify({ displayName, email, roleId }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '新增失敗')
            router.push('/admin/staff')
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
                <Link href="/admin/staff"
                    className={`text-sm px-3 py-1.5 rounded-lg border ${btn.surface}`}
                    style={css.surface}>
                    <span style={css.muted}>← 返回</span>
                </Link>
                <h1 className="text-xl font-semibold" style={css.text}>新增人員</h1>
            </div>

            <div className="rounded-xl border p-6" style={css.surface}>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>姓名 *</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            required
                            placeholder="例：王小明"
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>Email *</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="example@email.com"
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>角色 *</label>
                        <select
                            value={roleId}
                            onChange={e => setRoleId(e.target.value)}
                            required
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        >
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${btn.solid}`}
                        style={{ backgroundColor: 'var(--color-admin-primary)' }}
                    >
                        {loading ? '新增中...' : '新增並寄送邀請信'}
                    </button>
                </form>
            </div>
        </div>
    )
}
