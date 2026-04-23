'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'

export default function EditSessionPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [title, setTitle] = useState('')
    const [opensAt, setOpensAt] = useState('')
    const [closesAt, setClosesAt] = useState('')
    const [perPersonLimit, setPerPersonLimit] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
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
            })
            .finally(() => setLoading(false))
    }, [])

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault()
        setSaving(true)
        setError(null)

        try {
            const res = await adminFetch(`/api/admin/sessions/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    title,
                    opensAt: opensAt || null,
                    closesAt: closesAt || null,
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

    if (loading) return <div className="p-6">載入中...</div>

    return (
        <div className="p-6 max-w-lg mx-auto">
            <h1 className="text-2xl font-bold mb-6">編輯開單</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">開單名稱 *</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
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
                    disabled={saving}
                    className="w-full bg-blue-500 text-white rounded py-2 text-sm disabled:opacity-50"
                >
                    {saving ? '儲存中...' : '儲存'}
                </button>
            </form>
        </div>
    )
}

function toDatetimeLocal(iso: string): string {
    return iso.slice(0, 16)
}
