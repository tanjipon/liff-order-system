'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import { useMinLoading } from '@/hooks/useMinLoading'

type PickupOption = {
    id: string
    name: string
    description: string | null
    extra_fee: number
    allowed_payment_methods: string[] | null
    is_active: boolean
    sort_order: number
}

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
    border: { borderColor: 'var(--color-admin-border)' },
} as const

export default function PickupOptionsPage() {
    const [options, setOptions] = useState<PickupOption[]>([])
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editState, setEditState] = useState<{
        id: string; name: string; description: string; extraFee: string; bankOnly: boolean
    } | null>(null)

    const { combine } = useMinLoading(1000)
    const isLoading = combine(dataLoaded)

    async function loadOptions() {
        try {
            const res = await adminFetch('/api/admin/pickup-options')
            const body = await res.json()
            if (body.data) setOptions(body.data)
            else setError(body.error ?? '載入失敗')
        } catch {
            setError('載入失敗')
        } finally {
            setDataLoaded(true)
        }
    }

    useEffect(() => { loadOptions() }, [])

    async function handleEdit(e: React.SyntheticEvent) {
        e.preventDefault()
        if (!editState) return
        const res = await adminFetch(`/api/admin/pickup-options/${editState.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                name: editState.name,
                description: editState.description || null,
                extraFee: Number(editState.extraFee) || 0,
                allowedPaymentMethods: editState.bankOnly ? ['bank_transfer'] : null,
            }),
        })
        if (res.ok) {
            setEditState(null)
            loadOptions()
        }
    }

    async function handleToggle(id: string) {
        await adminFetch(`/api/admin/pickup-options/${id}/toggle`, { method: 'PATCH' })
        loadOptions()
    }

    if (isLoading) return <AdminSpinner />
    if (error) return <div className="p-8 text-sm" style={{ color: '#DC2626' }}>{error}</div>

    return (
        <div className="p-6 max-w-3xl mx-auto">

            {/* 頁首 */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold" style={css.text}>取貨方式管理</h1>
                    <p className="text-sm mt-0.5" style={css.muted}>{options.length} 種取貨方式</p>
                </div>
                <Link
                    href="/admin/pickup-options/new"
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-admin-primary)' }}
                >
                    新增取貨方式
                </Link>
            </div>

            {options.length === 0 ? (
                <div className="rounded-xl border p-12 text-center" style={css.surface}>
                    <p className="text-sm" style={css.muted}>尚未新增任何取貨方式</p>
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden" style={css.surface}>
                    {options.map((opt, idx) => (
                        <div key={opt.id}
                            className={`p-4 ${idx !== 0 ? 'border-t' : ''}`}
                            style={idx !== 0 ? css.border : {}}>
                            {editState?.id === opt.id ? (
                                <form onSubmit={handleEdit} className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={css.muted}>名稱 *</label>
                                        <input value={editState.name}
                                            onChange={e => setEditState({ ...editState, name: e.target.value })}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                            style={css.surface} required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={css.muted}>說明（選填）</label>
                                        <input value={editState.description}
                                            onChange={e => setEditState({ ...editState, description: e.target.value })}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                            style={css.surface} placeholder="說明（選填）" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={css.muted}>附加費用（NT$）</label>
                                        <input type="number" min="0" value={editState.extraFee}
                                            onChange={e => setEditState({ ...editState, extraFee: e.target.value })}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                            style={css.surface} placeholder="0" />
                                    </div>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={editState.bankOnly}
                                            onChange={e => setEditState({ ...editState, bankOnly: e.target.checked })}
                                            className="accent-blue-600" />
                                        <span style={css.text}>僅限銀行匯款</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <button type="submit"
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                                            style={{ backgroundColor: 'var(--color-admin-primary)' }}>儲存</button>
                                        <button type="button" onClick={() => setEditState(null)}
                                            className="px-3 py-1.5 rounded-lg text-xs border"
                                            style={css.surface}>
                                            <span style={css.muted}>取消</span>
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="flex justify-between items-start gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-sm" style={css.text}>{opt.name}</p>
                                            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                                                style={opt.is_active
                                                    ? { backgroundColor: '#DCFCE7', color: '#166534' }
                                                    : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                                                }>
                                                {opt.is_active ? '上架' : '下架'}
                                            </span>
                                            {opt.allowed_payment_methods && (
                                                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                                                    style={{ backgroundColor: '#EDE9FE', color: '#5B21B6' }}>
                                                    僅限匯款
                                                </span>
                                            )}
                                        </div>
                                        {opt.description && (
                                            <p className="text-xs mt-0.5" style={css.muted}>{opt.description}</p>
                                        )}
                                        <p className="text-xs mt-0.5" style={css.muted}>
                                            附加費用：{opt.extra_fee > 0 ? `NT$ ${opt.extra_fee}` : '免費'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => setEditState({
                                                id: opt.id, name: opt.name,
                                                description: opt.description ?? '',
                                                extraFee: String(opt.extra_fee),
                                                bankOnly: opt.allowed_payment_methods !== null,
                                            })}
                                            className="px-3 py-1.5 rounded-lg text-xs border"
                                            style={css.surface}>
                                            <span style={css.muted}>編輯</span>
                                        </button>
                                        <button
                                            onClick={() => handleToggle(opt.id)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                                            style={opt.is_active
                                                ? { backgroundColor: '#FEE2E2', color: '#991B1B' }
                                                : { backgroundColor: '#DCFCE7', color: '#166534' }
                                            }>
                                            {opt.is_active ? '下架' : '上架'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
