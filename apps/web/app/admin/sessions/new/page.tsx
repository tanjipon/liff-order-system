'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'

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
                    opensAt: opensAt || null,
                    closesAt: closesAt || null,
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
            <h1 className="text-2xl font-bold mb-6">新增開單</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">開單名稱 *</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="例：4月甜點預購"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">開放時間（選填）</label>
                    <input
                        type="datetime-local"
                        value={opensAt}
                        onChange={e => setOpensAt(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">截止時間（選填）</label>
                    <input
                        type="datetime-local"
                        value={closesAt}
                        onChange={e => setClosesAt(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">每人上限（選填）</label>
                    <input
                        type="number"
                        min="1"
                        value={perPersonLimit}
                        onChange={e => setPerPersonLimit(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="不填表示無限制"
                    />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-500 text-white rounded py-2 text-sm disabled:opacity-50"
                >
                    {loading ? '建立中...' : '建立開單'}
                </button>
            </form>
        </div>
    )
}
