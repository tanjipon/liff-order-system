'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'

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
            <h1 className="text-2xl font-bold mb-6">新增角色</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">角色名稱 *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="例：baker"
                    />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-500 text-white rounded py-2 text-sm disabled:opacity-50"
                >
                    {loading ? '新增中...' : '新增角色'}
                </button>
            </form>
        </div>
    )
}
