'use client'

import { useEffect, useState } from 'react'
import LiffLoader from '@/components/liff/LiffLoader'
import { useMinLoading } from '@/hooks/useMinLoading'

type OrderItem = {
    quantity: number
    unit_price: number
    product_id: string
    products: { name: string }
}

type Order = {
    id: string
    status: string
    payment_method: string
    total_amount: number
    pickup_fee: number
    remit_last5: string | null
    queue_number: number | null
    created_at: string
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

export default function StatusPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
    const [editQuantities, setEditQuantities] = useState<Record<string, number>>({})
    const [submitting, setSubmitting] = useState(false)
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
    const [remitInputs, setRemitInputs] = useState<Record<string, string>>({})
    const [remitSubmitting, setRemitSubmitting] = useState(false)

    const { combine } = useMinLoading(1500)
    const isLoading = combine(dataLoaded)

    useEffect(() => {
        fetch('/api/orders', { headers: { 'x-liff-token': 'mock-token' } })
            .then(res => res.json())
            .then(body => {
                if (body.data) setOrders(body.data)
                else setError(body.message ?? '載入失敗')
            })
            .catch(() => setError('載入失敗，請稍後再試'))
            .finally(() => setDataLoaded(true))
    }, [])

    function startEdit(order: Order) {
        setEditingOrderId(order.id)
        const init: Record<string, number> = {}
        order.order_items.forEach(item => { init[item.products.name] = item.quantity })
        setEditQuantities(init)
    }

    async function submitEdit(order: Order) {
        setSubmitting(true)
        try {
            const items = order.order_items
                .filter(i => (editQuantities[i.products.name] ?? 0) > 0)
                .map(i => ({ product_id: i.product_id, quantity: editQuantities[i.products.name] }))

            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-liff-token': 'mock-token' },
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

    async function submitCancel(orderId: string) {
        setSubmitting(true)
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'DELETE',
                headers: { 'x-liff-token': 'mock-token' }
            })
            if (!res.ok) {
                const body = await res.json()
                throw new Error(body.message ?? '取消失敗')
            }
            window.location.reload()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSubmitting(false)
            setCancellingOrderId(null)
        }
    }

    async function submitRemit(orderId: string) {
        const remitLast5 = remitInputs[orderId]?.trim()
        if (!remitLast5 || remitLast5.length !== 5) return
        setRemitSubmitting(true)
        try {
            const res = await fetch(`/api/orders/${orderId}/remit`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-liff-token': 'mock-token' },
                body: JSON.stringify({ remitLast5 })
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

    if (error) return (
        <div className="min-h-screen w-full flex items-center justify-center p-4" style={css.bg}>
            <p className="text-sm text-center" style={{ color: '#C0392B' }}>{error}</p>
        </div>
    )

    if (orders.length === 0) return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4" style={css.bg}>
            <p className="text-4xl mb-4">🛍️</p>
            <p className="text-sm" style={css.muted}>目前沒有訂單紀錄</p>
        </div>
    )

    return (
        <div className="min-h-screen w-full" style={css.bg}>
            <div className="max-w-md mx-auto p-4">
                <h1 className="text-xl font-bold mb-4" style={css.text}>我的訂單</h1>

                <div className="space-y-4">
                    {orders.map(order => (
                        <div key={order.id} className="rounded-2xl border p-4 space-y-3" style={css.surface}>

                            {/* 狀態列 */}
                            <div className="flex justify-between items-center">
                                <span className="text-xs px-3 py-1 rounded-full font-semibold"
                                    style={STATUS_STYLE[order.status]}>
                                    {STATUS_LABEL[order.status]}
                                </span>
                                {order.queue_number && (
                                    <span className="text-xs font-medium" style={css.muted}>
                                        隊伍號碼 #{order.queue_number}
                                    </span>
                                )}
                            </div>

                            {/* 品項列表 or 編輯模式 */}
                            {order.status === 'pending' && editingOrderId === order.id ? (
                                <div className="space-y-2">
                                    {order.order_items.map(item => (
                                        <div key={item.product_id} className="flex items-center justify-between text-sm">
                                            <span style={css.text}>{item.products.name}</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setEditQuantities(prev => ({
                                                        ...prev,
                                                        [item.products.name]: Math.max(0, (prev[item.products.name] ?? 0) - 1)
                                                    }))}
                                                    className="w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold"
                                                    style={css.surface}
                                                >−</button>
                                                <span className="w-8 text-center tabular-nums text-sm font-medium" style={css.text}>
                                                    {editQuantities[item.products.name] ?? 0}
                                                </span>
                                                <button
                                                    onClick={() => setEditQuantities(prev => ({
                                                        ...prev,
                                                        [item.products.name]: (prev[item.products.name] ?? 0) + 1
                                                    }))}
                                                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
                                                    style={css.primary}
                                                >+</button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => submitEdit(order)}
                                            disabled={submitting || Object.values(editQuantities).every(q => q === 0)}
                                            className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                                            style={css.primary}
                                        >送出修改</button>
                                        <button
                                            onClick={() => setEditingOrderId(null)}
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

                            {/* pending 操作按鈕（非編輯模式） */}
                            {order.status === 'pending' && editingOrderId !== order.id && (
                                <div>
                                    {cancellingOrderId === order.id ? (
                                        <div className="rounded-xl p-3 space-y-2" style={css.danger}>
                                            <p className="text-sm font-medium">確定要取消這筆訂單嗎？</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => submitCancel(order.id)}
                                                    disabled={submitting}
                                                    className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                                                    style={{ backgroundColor: '#C0392B' }}
                                                >確認取消</button>
                                                <button
                                                    onClick={() => setCancellingOrderId(null)}
                                                    className="flex-1 py-2 rounded-xl text-sm border"
                                                    style={css.surface}
                                                >我再想想</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-row gap-2">
                                            <button
                                                onClick={() => startEdit(order)}
                                                className="text-sm font-medium underline underline-offset-2"
                                                style={css.accent}
                                            >修改訂單</button>
                                            <button
                                                onClick={() => setCancellingOrderId(order.id)}
                                                className="text-sm underline underline-offset-2"
                                                style={{ color: '#C0392B' }}
                                            >取消訂單</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 費用總覽 */}
                            <div className="border-t pt-3 space-y-1" style={css.border}>
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

                            {/* 狀態相關訊息 */}
                            {order.status === 'pending' && (
                                <p className="text-xs" style={css.muted}>等待店家確認中，請耐心等候</p>
                            )}
                            {order.status === 'in_production' && (
                                <p className="text-xs" style={{ color: '#1D4ED8' }}>店家已接單，正在為您製作 🍰</p>
                            )}

                            {/* 待付款：匯款或現金 */}
                            {order.status === 'pending_payment' && (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold" style={{ color: '#C2410C' }}>
                                        製作完成！請完成付款
                                    </p>
                                    {order.payment_method === 'bank_transfer' ? (
                                        <>
                                            <div className="rounded-xl p-3 text-xs space-y-1"
                                                style={{ backgroundColor: '#FFF5F0', color: 'var(--color-liff-text)' }}>
                                                <p>銀行代碼：{process.env.NEXT_PUBLIC_BANK_CODE}</p>
                                                <p>帳號：{process.env.NEXT_PUBLIC_BANK_ACCOUNT}</p>
                                                <p>戶名：{process.env.NEXT_PUBLIC_BANK_HOLDER}</p>
                                                <p className="font-bold" style={{ color: '#C2410C' }}>
                                                    匯款金額：NT$ {order.total_amount}
                                                </p>
                                            </div>
                                            <p className="text-xs" style={css.muted}>匯款完成後，請填入帳號後五碼：</p>
                                            <input
                                                type="text"
                                                maxLength={5}
                                                placeholder="例如：12345"
                                                value={remitInputs[order.id] ?? ''}
                                                onChange={e => setRemitInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                className="w-full border rounded-xl px-3 py-2 text-sm"
                                                style={css.surface}
                                            />
                                            <button
                                                onClick={() => submitRemit(order.id)}
                                                disabled={remitSubmitting || (remitInputs[order.id]?.trim().length ?? 0) !== 5}
                                                className="w-full py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                                                style={{ backgroundColor: '#C2410C' }}
                                            >送出匯款資訊</button>
                                        </>
                                    ) : (
                                        <div className="rounded-xl p-3 text-sm"
                                            style={{ backgroundColor: '#FFF5F0' }}>
                                            <p className="font-semibold" style={css.text}>請到現場以現金付款</p>
                                            <p className="text-xs mt-1" style={css.muted}>
                                                付款金額：NT$ {order.total_amount}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {order.status === 'payment_submitted' && order.remit_last5 && (
                                <p className="text-xs" style={{ color: '#6D28D9' }}>
                                    已收到您的匯款後五碼：{order.remit_last5}
                                </p>
                            )}
                            {order.status === 'completed' && (
                                <p className="text-xs" style={{ color: '#065F46' }}>感謝您的購買！🎉</p>
                            )}

                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
