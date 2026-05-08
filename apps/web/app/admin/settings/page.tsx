'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import AdminError from '@/components/admin/AdminError'
import { useMinLoading } from '@/hooks/useMinLoading'

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
    border: { borderColor: 'var(--color-admin-border)' },
} as const

export default function SettingsPage() {
    const [shopName, setShopName] = useState('')
    const [bankCode, setBankCode] = useState('')
    const [bankAccount, setBankAccount] = useState('')
    const [bankHolder, setBankHolder] = useState('')
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingShop, setEditingShop] = useState(false)
    const [editShopName, setEditShopName] = useState('')
    const [savingShop, setSavingShop] = useState(false)

    const [editingBank, setEditingBank] = useState(false)
    const [editCode, setEditCode] = useState('')
    const [editAccount, setEditAccount] = useState('')
    const [editHolder, setEditHolder] = useState('')
    const [savingBank, setSavingBank] = useState(false)

    const { combine } = useMinLoading(1000)
    const isLoading = combine(dataLoaded)

    async function load() {
        try {
            const res = await adminFetch('/api/admin/settings')
            const body = await res.json()
            if (body.data) {
                setShopName(body.data.shop_name ?? '')
                setBankCode(body.data.bank_code ?? '')
                setBankAccount(body.data.bank_account ?? '')
                setBankHolder(body.data.bank_holder ?? '')
            } else {
                setError(body.error ?? '載入失敗')
            }
        } catch {
            setError('載入失敗')
        } finally {
            setDataLoaded(true)
        }
    }

    useEffect(() => { load() }, [])

    async function saveSettings(patch: Record<string, string>) {
        const res = await adminFetch('/api/admin/settings', {
            method: 'PATCH',
            body: JSON.stringify(patch),
        })
        return res.ok
    }

    async function handleSaveShop(e: React.SyntheticEvent) {
        e.preventDefault()
        setSavingShop(true)
        try {
            if (await saveSettings({ shop_name: editShopName.trim() })) {
                setShopName(editShopName.trim())
                setEditingShop(false)
            }
        } finally {
            setSavingShop(false)
        }
    }

    async function handleSaveBank(e: React.SyntheticEvent) {
        e.preventDefault()
        setSavingBank(true)
        try {
            if (await saveSettings({
                bank_code: editCode.trim(),
                bank_account: editAccount.trim(),
                bank_holder: editHolder.trim(),
            })) {
                setBankCode(editCode.trim())
                setBankAccount(editAccount.trim())
                setBankHolder(editHolder.trim())
                setEditingBank(false)
            }
        } finally {
            setSavingBank(false)
        }
    }

    if (isLoading) return <AdminSpinner />
    if (error) return <AdminError error={error} onRetry={load} />

    return (
        <div className="p-6 max-w-xl mx-auto space-y-4">
            <div className="mb-2">
                <h1 className="text-xl font-semibold" style={css.text}>系統設定</h1>
            </div>

            {/* 店家名稱 */}
            <div className="rounded-xl border overflow-hidden" style={css.surface}>
                <div className="px-5 py-4 flex items-center justify-between border-b" style={css.border}>
                    <h2 className="text-sm font-semibold" style={css.text}>店家資訊</h2>
                    {!editingShop && (
                        <button
                            onClick={() => { setEditShopName(shopName); setEditingShop(true) }}
                            className="px-3 py-1.5 rounded-lg text-xs border"
                            style={css.surface}
                        >
                            <span style={css.muted}>編輯</span>
                        </button>
                    )}
                </div>

                {editingShop ? (
                    <form onSubmit={handleSaveShop} className="p-5 space-y-4">
                        <div>
                            <label className="block text-xs font-medium mb-1" style={css.muted}>店家名稱</label>
                            <input
                                value={editShopName}
                                onChange={e => setEditShopName(e.target.value)}
                                placeholder="例：甜點工作室"
                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                style={css.surface}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={savingShop}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                style={{ backgroundColor: 'var(--color-admin-primary)' }}>
                                {savingShop ? '儲存中...' : '儲存'}
                            </button>
                            <button type="button" onClick={() => setEditingShop(false)}
                                className="px-4 py-1.5 rounded-lg text-xs border"
                                style={css.surface}>
                                <span style={css.muted}>取消</span>
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="p-5">
                        <div className="flex items-center gap-4">
                            <span className="text-xs w-16 shrink-0" style={css.muted}>店家名稱</span>
                            <span className="text-sm" style={shopName ? css.text : css.muted}>
                                {shopName || '未設定'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* 銀行匯款資訊 */}
            <div className="rounded-xl border overflow-hidden" style={css.surface}>
                <div className="px-5 py-4 flex items-center justify-between border-b" style={css.border}>
                    <h2 className="text-sm font-semibold" style={css.text}>銀行匯款資訊</h2>
                    {!editingBank && (
                        <button
                            onClick={() => { setEditCode(bankCode); setEditAccount(bankAccount); setEditHolder(bankHolder); setEditingBank(true) }}
                            className="px-3 py-1.5 rounded-lg text-xs border"
                            style={css.surface}
                        >
                            <span style={css.muted}>編輯</span>
                        </button>
                    )}
                </div>

                {editingBank ? (
                    <form onSubmit={handleSaveBank} className="p-5 space-y-4">
                        <div>
                            <label className="block text-xs font-medium mb-1" style={css.muted}>銀行代碼</label>
                            <input value={editCode} onChange={e => setEditCode(e.target.value)}
                                placeholder="例：812"
                                className="w-full border rounded-lg px-3 py-2 text-sm" style={css.surface} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1" style={css.muted}>帳號</label>
                            <input value={editAccount} onChange={e => setEditAccount(e.target.value)}
                                placeholder="例：123456789"
                                className="w-full border rounded-lg px-3 py-2 text-sm" style={css.surface} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1" style={css.muted}>戶名</label>
                            <input value={editHolder} onChange={e => setEditHolder(e.target.value)}
                                placeholder="例：甜點工作室"
                                className="w-full border rounded-lg px-3 py-2 text-sm" style={css.surface} />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={savingBank}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                style={{ backgroundColor: 'var(--color-admin-primary)' }}>
                                {savingBank ? '儲存中...' : '儲存'}
                            </button>
                            <button type="button" onClick={() => setEditingBank(false)}
                                className="px-4 py-1.5 rounded-lg text-xs border"
                                style={css.surface}>
                                <span style={css.muted}>取消</span>
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="p-5 space-y-3">
                        {[
                            { label: '銀行代碼', value: bankCode },
                            { label: '帳號', value: bankAccount },
                            { label: '戶名', value: bankHolder },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex items-center gap-4">
                                <span className="text-xs w-16 shrink-0" style={css.muted}>{label}</span>
                                <span className="text-sm" style={value ? css.text : css.muted}>
                                    {value || '未設定'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
