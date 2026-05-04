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

export default function NewPickupOptionPage() {
    const router = useRouter()

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [extraFee, setExtraFee] = useState('')
    const [bankOnly, setBankOnly] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await adminFetch('/api/admin/pickup-options', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    description: description || null,
                    extraFee: Number(extraFee) || 0,
                    allowedPaymentMethods: bankOnly ? ['bank_transfer'] : null,
                }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '新增失敗')
            router.push('/admin/pickup-options')
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
                <Link href="/admin/pickup-options"
                    className="text-sm px-3 py-1.5 rounded-lg border"
                    style={css.surface}>
                    <span style={css.muted}>← 返回</span>
                </Link>
                <h1 className="text-xl font-semibold" style={css.text}>新增取貨方式</h1>
            </div>

            <div className="rounded-xl border p-6" style={css.surface}>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>名稱 *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            placeholder="例：自取"
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>說明（選填）</label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="取貨地點或說明"
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={css.muted}>附加費用（NT$，預設 0）</label>
                        <input
                            type="number"
                            min="0"
                            value={extraFee}
                            onChange={e => setExtraFee(e.target.value)}
                            placeholder="0"
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            style={css.surface}
                        />
                    </div>

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={bankOnly}
                            onChange={e => setBankOnly(e.target.checked)}
                            className="accent-blue-600"
                        />
                        <span style={css.text}>僅限銀行匯款</span>
                    </label>

                    {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-admin-primary)' }}
                    >
                        {loading ? '新增中...' : '新增'}
                    </button>
                </form>
            </div>
        </div>
    )
}
