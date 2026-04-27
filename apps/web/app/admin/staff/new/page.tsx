'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'

type Role = {
    id: string
    name: string
}

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
            <h1 className="text-2xl font-bold mb-6">新增人員</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">姓名 *</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="例：王小明"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Email *</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="example@email.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">角色 *</label>
                    <select
                        value={roleId}
                        onChange={e => setRoleId(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                    >
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-500 text-white rounded py-2 text-sm disabled:opacity-50"
                >
                    {loading ? '新增中...' : '新增並寄送邀請信'}
                </button>
            </form>
        </div>
    )
}
