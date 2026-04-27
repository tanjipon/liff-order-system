'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/auth/adminClient'

type PickupOption = {
    id: string
    name: string
    description: string | null
    extra_fee: number
    allowed_payment_methods: string[] | null
    is_active: boolean
    sort_order: number
}

export default function PickupOptionsPage() {
    const [options, setOptions] = useState<PickupOption[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // create form
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [extraFee, setExtraFee] = useState('')
    const [bankOnly, setBankOnly] = useState(false)
    const [adding, setAdding] = useState(false)
    const [addError, setAddError] = useState<string | null>(null)

    // edit
    const [editState, setEditState] = useState<{
        id: string; name: string; description: string; extraFee: string; bankOnly: boolean
    } | null>(null)

    async function loadOptions() {
        try {
            const res = await adminFetch('/api/admin/pickup-options')
            const body = await res.json()
            if (body.data) setOptions(body.data)
            else setError(body.error ?? '載入失敗')
        } catch {
            setError('載入失敗')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadOptions() }, [])

    async function handleAdd(e: React.SyntheticEvent) {
        e.preventDefault()
        setAdding(true)
        setAddError(null)
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
            setName('')
            setDescription('')
            setExtraFee('')
            setBankOnly(false)
            loadOptions()
        } catch (e: any) {
            setAddError(e.message)
        } finally {
            setAdding(false)
        }
    }

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

    if (loading) return <div className="p-6">載入中...</div>
    if (error)   return <div className="p-6 text-red-500">{error}</div>

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold">取貨方式管理</h1>

            {/* list */}
            <div className="space-y-3">
                {options.length === 0 && (
                    <p className="text-gray-400 text-sm">尚未新增任何取貨方式</p>
                )}
                {options.map(opt => (
                    <div key={opt.id} className="border rounded-lg p-4 space-y-2">
                        {editState?.id === opt.id ? (
                            <form onSubmit={handleEdit} className="space-y-2">
                                <input value={editState.name}
                                    onChange={e => setEditState({ ...editState, name: e.target.value })}
                                    className="w-full border rounded px-3 py-2 text-sm" required />
                                <input value={editState.description}
                                    onChange={e => setEditState({ ...editState, description: e.target.value })}
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    placeholder="說明（選填）" />
                                <input type="number" min="0" value={editState.extraFee}
                                    onChange={e => setEditState({ ...editState, extraFee: e.target.value })}
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    placeholder="附加費用" />
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={editState.bankOnly}
                                        onChange={e => setEditState({ ...editState, bankOnly: e.target.checked })} />
                                    僅限銀行匯款
                                </label>
                                <div className="flex gap-2">
                                    <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded text-sm">儲存</button>
                                    <button type="button" onClick={() => setEditState(null)} className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm">取消</button>
                                </div>
                            </form>
                        ) : (
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">{opt.name}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${opt.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {opt.is_active ? '上架' : '下架'}
                                        </span>
                                    </div>
                                    {opt.description && <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>}
                                    <p className="text-sm text-gray-500">
                                        費用：{opt.extra_fee > 0 ? `NT$ ${opt.extra_fee}` : '免費'}
                                        {opt.allowed_payment_methods && '・僅限匯款'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setEditState({
                                            id: opt.id, name: opt.name,
                                            description: opt.description ?? '',
                                            extraFee: String(opt.extra_fee),
                                            bankOnly: opt.allowed_payment_methods !== null,
                                        })}
                                        className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                                    >編輯</button>
                                    <button
                                        onClick={() => handleToggle(opt.id)}
                                        className={`px-3 py-1 rounded text-sm ${opt.is_active ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}
                                    >{opt.is_active ? '下架' : '上架'}</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* create form */}
            <div>
                <h2 className="text-lg font-semibold mb-3">新增取貨方式</h2>
                <form onSubmit={handleAdd} className="space-y-3">
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                        required placeholder="名稱 *"
                        className="w-full border rounded px-3 py-2 text-sm" />
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="說明（選填）"
                        className="w-full border rounded px-3 py-2 text-sm" />
                    <input type="number" min="0" value={extraFee} onChange={e => setExtraFee(e.target.value)}
                        placeholder="附加費用（預設 0）"
                        className="w-full border rounded px-3 py-2 text-sm" />
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={bankOnly} onChange={e => setBankOnly(e.target.checked)} />
                        僅限銀行匯款
                    </label>
                    {addError && <p className="text-red-500 text-sm">{addError}</p>}
                    <button type="submit" disabled={adding}
                        className="w-full bg-blue-500 text-white rounded py-2 text-sm disabled:opacity-50">
                        {adding ? '新增中...' : '新增'}
                    </button>
                </form>
            </div>
        </div>
    )
}
