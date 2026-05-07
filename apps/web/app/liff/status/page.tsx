'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LiffLoader from '@/components/liff/LiffLoader'
import LiffError from '@/components/liff/LiffError'
import { useMinLoading } from '@/hooks/useMinLoading'

type OrderItem = {
    quantity: number
    unit_price: number
    product_id: string
    products: { name: string }
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
    sessions: { title: string } | null
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

function needsAction(order: Order): boolean {
    return order.status === 'pending_payment' && order.payment_method === 'bank_transfer'
}

const css = {
    bg: { backgroundColor: 'var(--color-liff-bg)' },
    surface: { backgroundColor: 'var(--color-liff-surface)', borderColor: 'var(--color-liff-border)' },
    text: { color: 'var(--color-liff-text)' },
    muted: { color: 'var(--color-liff-muted)' },
    accent: { color: 'var(--color-liff-primary)' },
    border: { borderColor: 'var(--color-liff-border)' },
} as const

export default function StatusPage() {
    const router = useRouter()
    const [orders, setOrders] = useState<Order[]>([])
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

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

    if (isLoading) return <LiffLoader />

    if (error) return <LiffError error={error} backHref="/liff/sessions" />

    if (orders.length === 0) return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4" style={css.bg}>
            <p className="text-4xl mb-4">🛍️</p>
            <p className="text-sm" style={css.muted}>目前沒有訂單紀錄</p>
        </div>
    )

    return (
        <div className="min-h-screen w-full" style={css.bg}>
            <div className="max-w-md mx-auto p-4">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold" style={css.text}>我的訂單</h1>
                    <button
                        onClick={() => router.push('/liff/sessions')}
                        className="text-sm px-3 py-1.5 rounded-xl border"
                        style={css.surface}
                    >
                        <span style={css.muted}>← 繼續訂購</span>
                    </button>
                </div>

                <div className="space-y-3">
                    {orders.map(order => (
                        <button
                            key={order.id}
                            onClick={() => router.push(`/liff/orders/${order.id}`)}
                            className="w-full rounded-2xl border p-4 text-left"
                            style={css.surface}
                        >
                            {/* 狀態列 + Session 名稱 */}
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs px-3 py-1 rounded-full font-semibold"
                                    style={STATUS_STYLE[order.status]}>
                                    {STATUS_LABEL[order.status]}
                                </span>
                                {order.sessions?.title && (
                                <span className="text-sm font-bold tabular-nums" style={css.accent}>
                                    {order.sessions.title}
                                </span>
                                )}
                            </div>

                            {/* 訂單號碼 */}
                            <p className="text-xs font-bold mb-3" style={css.text}>單號 #{String(order.order_number).padStart(4, '0')}</p>

                            {/* 品項摘要 */}
                            <div className="space-y-0.5 mb-3">
                                {order.order_items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span style={css.muted}>{item.products.name} × {item.quantity}</span>
                                        <span style={css.text}>NT$ {item.unit_price * item.quantity}</span>
                                    </div>
                                ))}
                            </div>

                            {/* 總計 + 箭頭 */}
                            <div className="flex justify-between items-center border-t pt-3" style={css.border}>
                                <span className="text-sm font-bold" style={css.text}>
                                    NT$ {order.total_amount}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {needsAction(order) && (
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: '#FFF5F0', color: '#C2410C' }}>
                                            需要操作
                                        </span>
                                    )}
                                    <span className="text-sm" style={css.muted}>→</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
