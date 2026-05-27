'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import LiffLoader from '@/components/liff/LiffLoader'
import LiffError from '@/components/liff/LiffError'
import { useMinLoading } from '@/hooks/useMinLoading'
import { useLiff } from '@/components/liff/LiffProvider'
import { Clock, CheckCircle, PlusCircle, MinusCircle } from 'lucide-react'

type OrderItem = {
    quantity: number
    unit_price: number
    product_id: string
    products: { name: string; max_per_person: number | null; stock_qty: number }
}

type Order = {
    id: string
    order_number: number
    status: string
    payment_method: string
    total_amount: number
    pickup_fee: number
    remit_last5: string | null
    queue_number: number | null
    created_at: string
    customer_note: string | null
    customer_name: string
    customer_phone: string
    recipient_name: string
    recipient_phone: string
    recipient_address: string | null
    sessions: { title: string; per_person_limit: number | null } | null
    pickup_options: { name: string; description: string | null } | null
    order_items: OrderItem[]
}

const STATUS_LABEL: Record<string, string> = {
    pending: '待確認',
    in_production: '製作中',
    pending_payment: '待付款',
    payment_submitted: '付款確認中',
    completed: '已完成',
    cancelled: '已取消',
}

const STATUS_STYLE: Record<string, { backgroundColor: string; color: string }> = {
    pending: { backgroundColor: '#FFF8E6', color: '#92650A' },
    in_production: { backgroundColor: '#EFF6FF', color: '#1D4ED8' },
    pending_payment: { backgroundColor: '#FFF5F0', color: '#C2410C' },
    payment_submitted: { backgroundColor: '#F5F3FF', color: '#6D28D9' },
    completed: { backgroundColor: '#ECFDF5', color: '#065F46' },
    cancelled: { backgroundColor: '#F3F4F6', color: '#6B7280' },
}

const css = {
    bg: { backgroundColor: 'var(--color-liff-bg)' },
    surface: { backgroundColor: 'var(--color-liff-surface)', borderColor: 'var(--color-liff-border)' },
    primary: { backgroundColor: 'var(--color-liff-primary)' },
    text: { color: 'var(--color-liff-text)' },
    muted: { color: 'var(--color-liff-muted)' },
    accent: { color: 'var(--color-liff-primary)' },
    border: { borderColor: 'var(--color-liff-border)' },
    danger: { backgroundColor: '#FFE8ED', color: '#C0392B' },
} as const

export default function OrderDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const { ready, token, error: liffError } = useLiff()

    const [order, setOrder] = useState<Order | null>(null)
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingMode, setEditingMode] = useState(false)
    const [editQuantities, setEditQuantities] = useState<Record<string, number>>({})
    const [submitting, setSubmitting] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [remitInput, setRemitInput] = useState('')
    const [remitSubmitting, setRemitSubmitting] = useState(false)
    const [noteInput, setNoteInput] = useState('')
    const [noteEditing, setNoteEditing] = useState(false)
    const [noteSaving, setNoteSaving] = useState(false)

    const { combine } = useMinLoading(1000)
    const isLoading = combine(dataLoaded) || !ready

    useEffect(() => {
        if (!ready) return
        if (!token) {
            setError(liffError ?? '請透過 LINE 開啟此頁面')
            setDataLoaded(true)
            return
        }
        Promise.all([
            fetch(`/api/orders/${id}`, { headers: { 'x-liff-token': token } }).then(r => r.json()),
            fetch('/api/settings').then(r => r.json()),
        ])
            .then(([orderBody, settingsBody]) => {
                if (orderBody.data) {
                    setOrder(orderBody.data)
                    setRemitInput(orderBody.data.remit_last5 ?? '')
                    setNoteInput(orderBody.data.customer_note ?? '')
                } else setError(orderBody.message ?? '載入失敗')
                if (settingsBody.data) setSettings(settingsBody.data)
            })
            .catch(() => setError('載入失敗，請稍後再試'))
            .finally(() => setDataLoaded(true))
    }, [id, ready, token])

    function startEdit() {
        if (!order) return
        const init: Record<string, number> = {}
        order.order_items.forEach(item => { init[item.products.name] = item.quantity })
        setEditQuantities(init)
        setEditingMode(true)
    }

    async function submitEdit() {
        if (!order) return
        setSubmitting(true)
        setError(null)
        try {
            const items = order.order_items
                .filter(i => (editQuantities[i.products.name] ?? 0) > 0)
                .map(i => ({ product_id: i.product_id, quantity: editQuantities[i.products.name] }))

            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-liff-token': token ?? '' },
                body: JSON.stringify({ items })
            })
            if (!res.ok) {
                const body = await res.json()
                throw new Error(body.message ?? '修改失敗')
            }
            window.location.reload()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    async function submitCancel() {
        if (!order) return
        setSubmitting(true)
        setError(null)
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'DELETE',
                headers: { 'x-liff-token': token ?? '' }
            })
            if (!res.ok) {
                const body = await res.json()
                throw new Error(body.message ?? '取消失敗')
            }
            router.push('/liff/status')
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSubmitting(false)
            setCancelling(false)
        }
    }

    async function saveNote() {
        if (!order) return
        setNoteSaving(true)
        try {
            await fetch(`/api/orders/${order.id}/note`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-liff-token': token ?? '' },
                body: JSON.stringify({ note: noteInput.trim() || null })
            })
            setOrder({ ...order, customer_note: noteInput.trim() || null })
            setNoteEditing(false)
        } finally {
            setNoteSaving(false)
        }
    }

    async function submitRemit() {
        if (!order) return
        const trimmed = remitInput.trim()
        if (trimmed.length !== 5) return
        setRemitSubmitting(true)
        setError(null)
        try {
            const res = await fetch(`/api/orders/${order.id}/remit`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-liff-token': token ?? '' },
                body: JSON.stringify({ remitLast5: trimmed })
            })
            if (!res.ok) {
                const body = await res.json()
                throw new Error(body.message ?? '送出失敗')
            }
            window.location.reload()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setRemitSubmitting(false)
        }
    }

    if (isLoading) return <LiffLoader />

    if (error && !order) return <LiffError error={error} backHref="/liff/status" />

    if (!order) return null

    const perPersonLimit = order.sessions?.per_person_limit ?? null
    const totalEditQty = Object.values(editQuantities).reduce((s, q) => s + q, 0)

    return (
        <div className="min-h-screen w-full" style={css.bg}>
            <div className="max-w-md mx-auto p-4">

                {/* 頁首 */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => router.push('/liff/status')}
                        className="text-sm px-3 py-1.5 rounded-xl border"
                        style={css.surface}
                    >
                        <span style={css.muted}>← 返回</span>
                    </button>
                    <div>
                        <h1 className="text-lg font-bold" style={css.text}>訂單詳情</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs tabular-nums" style={css.muted}>
                                單號 #{String(order.order_number).padStart(4, '0')}
                            </p>
                            {order.sessions?.title && (
                                <>
                                    <span className="text-xs" style={css.muted}>·</span>
                                    <p className="text-xs" style={css.muted}>{order.sessions.title}</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-3">

                    {/* 狀態卡 */}
                    <div className="rounded-2xl border p-4" style={css.surface}>
                        <div className="flex justify-between items-center">
                            <span className="text-xs px-3 py-1 rounded-full font-semibold"
                                style={STATUS_STYLE[order.status]}>
                                {STATUS_LABEL[order.status]}
                            </span>
                            <div className="text-right">
                                <p className="text-xs" style={css.muted}>
                                    {new Date(order.created_at).toLocaleString('zh-TW', {
                                        month: 'numeric', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                                {order.queue_number && (
                                    <p className="text-xs font-medium tabular-nums" style={css.muted}>
                                        排單號碼 #{order.queue_number}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 狀態訊息 */}
                        <div className="mt-3">
                            {order.status === 'pending' && (
                                <p className="text-xs" style={css.muted}>等待店家確認中，請耐心等候</p>
                            )}
                            {order.status === 'in_production' && (
                                <p className="text-xs flex items-center gap-1" style={{ color: '#1D4ED8' }}>
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    店家已接單，正在為您製作
                                </p>
                            )}
                            {order.status === 'payment_submitted' && order.remit_last5 && (
                                <p className="text-xs" style={{ color: '#6D28D9' }}>
                                    已收到您的匯款後五碼：{order.remit_last5}，確認中請稍候
                                </p>
                            )}
                            {order.status === 'completed' && (
                                <p className="text-xs flex items-center gap-1" style={{ color: '#065F46' }}>
                                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                    感謝您的購買！
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 品項卡 */}
                    <div className="rounded-2xl border p-4" style={css.surface}>
                        <p className="text-xs font-semibold mb-3" style={css.muted}>訂購品項</p>

                        {editingMode ? (
                            <div className="space-y-2">
                                {perPersonLimit && (
                                    <p className="text-xs mb-1" style={
                                        totalEditQty > perPersonLimit ? { color: '#C0392B' } : css.muted
                                    }>
                                        每人限購 {perPersonLimit} 件・已選 {totalEditQty} 件
                                    </p>
                                )}
                                {order.order_items.map(item => {
                                    const qty = editQuantities[item.products.name] ?? 0
                                    const maxStock = item.products.stock_qty + item.quantity // 加回自己原本佔的庫存
                                    const maxPerProduct = item.products.max_per_person
                                    const maxByLimit = perPersonLimit !== null
                                        ? perPersonLimit - (totalEditQty - qty)
                                        : Infinity
                                    const effectiveMax = Math.min(
                                        maxStock,
                                        maxPerProduct ?? Infinity,
                                        maxByLimit
                                    )
                                    return (
                                    <div key={item.product_id} className="flex items-center justify-between text-sm">
                                        <div>
                                            <span style={css.text}>{item.products.name}</span>
                                            {maxPerProduct && (
                                                <p className="text-xs" style={css.muted}>單品限購 {maxPerProduct} 件</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setEditQuantities(prev => ({
                                                    ...prev,
                                                    [item.products.name]: Math.max(0, qty - 1)
                                                }))}
                                            ><MinusCircle className="w-7 h-7" style={css.muted} /></button>
                                            <span className="w-8 text-center tabular-nums text-sm font-medium" style={css.text}>
                                                {qty}
                                            </span>
                                            <button
                                                disabled={qty >= effectiveMax}
                                                onClick={() => setEditQuantities(prev => ({
                                                    ...prev,
                                                    [item.products.name]: qty + 1
                                                }))}
                                                style={{ opacity: qty >= effectiveMax ? 0.4 : 1 }}
                                            ><PlusCircle className="w-7 h-7" style={{ color: 'var(--color-liff-primary)' }} /></button>
                                        </div>
                                    </div>
                                    )
                                })}
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={submitEdit}
                                        disabled={submitting || Object.values(editQuantities).every(q => q === 0)}
                                        className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                                        style={css.primary}
                                    >送出修改</button>
                                    <button
                                        onClick={() => setEditingMode(false)}
                                        className="flex-1 py-2 rounded-xl text-sm border"
                                        style={{ ...css.surface, color: 'var(--color-liff-muted)' }}
                                    >取消</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {order.order_items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span style={css.muted}>{item.products.name} × {item.quantity}</span>
                                        <span style={css.text}>NT$ {item.unit_price * item.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 費用總覽 */}
                        {!editingMode && (
                            <div className="border-t mt-3 pt-3 space-y-1" style={css.border}>
                                {order.pickup_fee > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span style={css.muted}>取貨費用</span>
                                        <span style={css.muted}>NT$ {order.pickup_fee}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm font-bold">
                                    <span style={css.text}>總計</span>
                                    <span style={css.accent}>NT$ {order.total_amount}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pickup method card */}
                    {order.pickup_options && (
                        <div className="rounded-2xl border p-4" style={css.surface}>
                            <p className="text-xs mb-1" style={css.muted}>取貨方式</p>
                            <p className="font-semibold text-sm" style={css.text}>{order.pickup_options.name}</p>
                            {order.pickup_options.description && (
                                <p className="text-xs mt-0.5" style={css.muted}>{order.pickup_options.description}</p>
                            )}
                        </div>
                    )}

                    {/* 聯絡資訊卡 */}
                    {(order.customer_name || order.recipient_name) && (
                        <div className="rounded-2xl border p-4 space-y-3" style={css.surface}>
                            <p className="text-xs font-semibold" style={css.muted}>聯絡資訊</p>
                            <div className="space-y-1">
                                <p className="text-xs" style={css.muted}>訂購人</p>
                                <p className="text-sm" style={css.text}>
                                    {order.customer_name}　{order.customer_phone}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs" style={css.muted}>收貨人</p>
                                <p className="text-sm" style={css.text}>
                                    {order.recipient_name}　{order.recipient_phone}
                                </p>
                            </div>
                            {order.recipient_address && (
                                <div className="space-y-1">
                                    <p className="text-xs" style={css.muted}>收貨地址</p>
                                    <p className="text-sm" style={css.text}>{order.recipient_address}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* pending 操作卡 */}
                    {order.status === 'pending' && !editingMode && (
                        <div className="rounded-2xl border p-4" style={css.surface}>
                            {cancelling ? (
                                <div className="rounded-xl p-3 space-y-2" style={css.danger}>
                                    <p className="text-sm font-medium">確定要取消這筆訂單嗎？</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={submitCancel}
                                            disabled={submitting}
                                            className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                                            style={{ backgroundColor: '#C0392B' }}
                                        >確認取消</button>
                                        <button
                                            onClick={() => setCancelling(false)}
                                            className="flex-1 py-2 rounded-xl text-sm border"
                                            style={css.surface}
                                        >我再想想</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-4">
                                    {/* <button
                                        onClick={startEdit}
                                        className="text-sm font-medium underline underline-offset-2"
                                        style={css.accent}
                                    >修改訂單</button> */}
                                    <button
                                        onClick={() => setCancelling(true)}
                                        className="text-sm underline underline-offset-2"
                                        style={{ color: '#C0392B' }}
                                    >取消訂單</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 待付款卡 */}
                    {order.status === 'pending_payment' && (
                        <div className="rounded-2xl border p-4 space-y-3" style={css.surface}>
                            <p className="text-sm font-semibold" style={{ color: '#C2410C' }}>
                                製作完成！請完成付款
                            </p>
                            {order.payment_method === 'bank_transfer' ? (
                                <>
                                    <div className="rounded-xl p-3 text-xs space-y-1"
                                        style={{ backgroundColor: '#FFF5F0', color: 'var(--color-liff-text)' }}>
                                        <p>銀行代碼：{settings.bank_code}</p>
                                        <p>帳號：{settings.bank_account}</p>
                                        <p>戶名：{settings.bank_holder}</p>
                                        <p className="font-bold" style={{ color: '#C2410C' }}>
                                            匯款金額：NT$ {order.total_amount}
                                        </p>
                                    </div>
                                    <p className="text-xs" style={css.muted}>匯款完成後，請填入帳號後五碼：</p>
                                    <input
                                        type="text"
                                        maxLength={5}
                                        placeholder="例如：12345"
                                        value={remitInput}
                                        onChange={e => setRemitInput(e.target.value)}
                                        className="w-full border rounded-xl px-3 py-2 text-sm"
                                        style={css.surface}
                                    />
                                    <button
                                        onClick={submitRemit}
                                        disabled={remitSubmitting || remitInput.trim().length !== 5}
                                        className="w-full py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                                        style={{ backgroundColor: '#C2410C' }}
                                    >送出匯款資訊</button>
                                </>
                            ) : (
                                <div className="rounded-xl p-3 text-sm space-y-1"
                                    style={{ backgroundColor: '#FFF5F0' }}>
                                    <p className="font-semibold" style={css.text}>請到現場以現金付款</p>
                                    <p className="text-xs" style={{ color: '#C2410C' }}>
                                        付款金額：NT$ {order.total_amount}
                                    </p>
                                    <p className="text-xs" style={css.muted}>
                                        付款後店家將確認並完成訂單
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 備註卡 */}
                    {order.status !== 'cancelled' && (
                        <div className="rounded-2xl border p-4" style={css.surface}>
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-semibold" style={css.muted}>備註（給店家的留言）</p>
                                {!noteEditing && (
                                    <button
                                        onClick={() => { setNoteInput(order.customer_note ?? ''); setNoteEditing(true) }}
                                        className="text-xs underline underline-offset-2"
                                        style={css.accent}
                                    >{order.customer_note ? '編輯' : '新增備註'}</button>
                                )}
                            </div>

                            {noteEditing ? (
                                <div className="space-y-2">
                                    <textarea
                                        value={noteInput}
                                        onChange={e => setNoteInput(e.target.value)}
                                        rows={3}
                                        placeholder="想說的話"
                                        className="w-full border rounded-xl px-3 py-2 text-sm resize-none"
                                        style={css.surface}
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={saveNote}
                                            disabled={noteSaving}
                                            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                                            style={css.primary}
                                        >{noteSaving ? '儲存中...' : '儲存'}</button>
                                        <button
                                            onClick={() => setNoteEditing(false)}
                                            className="flex-1 py-2 rounded-xl text-sm border"
                                            style={{ ...css.surface, color: 'var(--color-liff-muted)' }}
                                        >取消</button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm" style={order.customer_note ? css.text : css.muted}>
                                    {order.customer_note ?? '尚未填寫備註'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* 錯誤訊息 */}
                    {error && (
                        <div className="rounded-xl p-3 text-sm text-center"
                            style={{ backgroundColor: '#FFE8ED', color: '#C0392B' }}>
                            {error}
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
