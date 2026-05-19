'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/auth/adminClient'
import Pagination from '@/components/admin/Pagination'

type Order = {
    id: string
    status: string
    line_display_name: string
    total_amount: number
    pickup_fee: number
    queue_number: number | null
    payment_method: string
    remit_last5: string | null
    created_at: string
    pickup_options: { name: string } | null
    customer_name: string
    customer_phone: string
    recipient_name: string
    recipient_phone: string
    recipient_address: string | null
    customer_note: string | null
    admin_note: string | null
    order_items: {
        quantity: number
        unit_price: number
        products: { name: string }
    }[]
}

type Session = {
    id: string
    title: string
}

type Product = {
    id: string
    name: string
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
    pending:           { backgroundColor: '#FEF9C3', color: '#854D0E' },
    in_production:     { backgroundColor: '#DBEAFE', color: '#1E40AF' },
    pending_payment:   { backgroundColor: '#FFEDD5', color: '#9A3412' },
    payment_submitted: { backgroundColor: '#EDE9FE', color: '#5B21B6' },
    completed:         { backgroundColor: '#DCFCE7', color: '#166534' },
    cancelled:         { backgroundColor: '#F3F4F6', color: '#6B7280' },
}

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
    border: { borderColor: 'var(--color-admin-border)' },
} as const

const btn = {
    solid: 'cursor-pointer transition hover:brightness-90 active:brightness-75 disabled:hover:brightness-100 disabled:active:brightness-100',
    surface: 'cursor-pointer transition hover:brightness-95 active:brightness-90 disabled:hover:brightness-100 disabled:active:brightness-100',
} as const

const LIMIT = 20

export default function OrderHistoryPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)

    const [status, setStatus] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [sessionId, setSessionId] = useState('')
    const [productId, setProductId] = useState('')

    const [sessions, setSessions] = useState<Session[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // 載入 session 列表
    useEffect(() => {
        adminFetch('/api/admin/sessions')
            .then(r => r.json())
            .then(body => setSessions(body.data ?? []))
    }, [])

    // 選 session 後載入該 session 的商品
    useEffect(() => {
        setProductId('')
        setProducts([])
        if (!sessionId) return
        adminFetch(`/api/admin/sessions/${sessionId}`)
            .then(r => r.json())
            .then(body => setProducts(body.data?.products ?? []))
    }, [sessionId])

    async function fetchOrders(p: number, scroll = false) {
        setLoading(true)
        const params = new URLSearchParams({ history: 'true', page: String(p), limit: String(LIMIT) })
        if (status) params.set('status', status)
        if (sessionId) params.set('sessionId', sessionId)
        if (productId) params.set('productId', productId)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)

        const res = await adminFetch(`/api/admin/orders?${params}`)
        const body = await res.json()
        setOrders(body.data ?? [])
        setTotal(body.total ?? 0)
        setTotalPages(body.totalPages ?? 0)
        setPage(p)
        setLoading(false)
        setSearched(true)
        if (scroll) {
            requestAnimationFrame(() => {
                document.getElementById('admin-main')?.scrollTo({ top: 0, behavior: 'smooth' })
                window.scrollTo({ top: 0, behavior: 'smooth' })
            })
        }
    }

    async function handleSearch() {
        fetchOrders(1)
    }

    function handlePageChange(p: number) {
        fetchOrders(p, true)
    }

    async function handleExport() {
        const params = new URLSearchParams()
        if (status) params.set('status', status)
        if (sessionId) params.set('sessionId', sessionId)
        if (productId) params.set('productId', productId)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)

        const res = await adminFetch(`/api/admin/orders/export?${params}`)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'orders.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="p-6 max-w-3xl mx-auto">

            {/* 頁首 */}
            <div className="mb-6">
                <h1 className="text-xl font-semibold" style={css.text}>歷史訂單查詢</h1>
                {searched && (
                    <p className="text-sm mt-0.5" style={css.muted}>{orders.length} 筆結果</p>
                )}
            </div>

            {/* 篩選列 */}
            <div className="rounded-xl border p-4 mb-6 space-y-3 overflow-hidden" style={css.surface}>
                {/* 電腦版同一列，手機版狀態獨一列、日期獨一列 */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex flex-col gap-1 md:flex-1">
                        <label className="text-xs font-medium" style={css.muted}>狀態</label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm w-full cursor-pointer"
                            style={css.surface}
                        >
                            <option value="">所有狀態</option>
                            {Object.entries(STATUS_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:flex-1">
                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-medium" style={css.muted}>開始日期</label>
                                {dateFrom && <button type="button" onClick={() => setDateFrom('')} className="text-xs cursor-pointer" style={css.muted}>清除</button>}
                            </div>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="border rounded-lg px-2 py-2 text-xs w-full min-w-0"
                                style={css.surface}
                            />
                        </div>

                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-medium" style={css.muted}>結束日期</label>
                                {dateTo && <button type="button" onClick={() => setDateTo('')} className="text-xs cursor-pointer" style={css.muted}>清除</button>}
                            </div>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="border rounded-lg px-2 py-2 text-xs w-full min-w-0"
                                style={css.surface}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                    <div className="flex flex-col gap-1 flex-1 min-w-40">
                        <label className="text-xs font-medium" style={css.muted}>開單</label>
                        <select
                            value={sessionId}
                            onChange={e => setSessionId(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm w-full cursor-pointer"
                            style={css.surface}
                        >
                            <option value="">所有開單</option>
                            {sessions.map(s => (
                                <option key={s.id} value={s.id}>{s.title}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1 flex-1 min-w-40">
                        <label className="text-xs font-medium" style={css.muted}>商品</label>
                        <select
                            value={productId}
                            onChange={e => setProductId(e.target.value)}
                            disabled={!sessionId}
                            className="border rounded-lg px-3 py-2 text-sm w-full disabled:opacity-40 cursor-pointer"
                            style={css.surface}
                        >
                            <option value="">所有商品</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 justify-end">
                    <button
                        onClick={handleExport}
                        disabled={!searched || loading}
                        className={`px-4 py-2 rounded-lg text-sm border disabled:opacity-40 ${btn.surface}`}
                        style={css.surface}
                    >
                        <span style={css.muted}>匯出 CSV</span>
                    </button>
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${btn.solid}`}
                        style={{ backgroundColor: 'var(--color-admin-primary)' }}
                    >
                        {loading ? '查詢中...' : '查詢'}
                    </button>
                </div>
            </div>

            {/* 結果 */}
            {!searched && (
                <div className="p-12 text-center">
                    <p className="text-sm" style={css.muted}>設定篩選條件後按查詢</p>
                </div>
            )}

            {searched && orders.length === 0 && (
                <div className="p-12 text-center">
                    <p className="text-sm" style={css.muted}>查無符合的訂單</p>
                </div>
            )}

            {orders.length > 0 && (
                <>
                    <div className="space-y-3">
                        {orders.map((order) => {
                            const isExpanded = expandedId === order.id
                            const sameRecipient =
                                order.recipient_name === order.customer_name &&
                                order.recipient_phone === order.customer_phone

                            return (
                            <div key={order.id}
                                className="rounded-xl border overflow-hidden"
                                style={css.surface}>

                                {/* Summary row — click to toggle detail */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                    className={`w-full text-left p-4 flex flex-wrap md:flex-nowrap items-center gap-3 ${btn.surface}`}
                                >
                                    {/* Status badge */}
                                    <div className="shrink-0">
                                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                                            style={STATUS_STYLE[order.status] ?? { backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                                            {STATUS_LABEL[order.status] ?? order.status}
                                        </span>
                                    </div>

                                    {/* Customer + items */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-sm" style={css.text}>{order.line_display_name}</p>
                                            {order.queue_number && (
                                                <span className="text-xs font-mono font-semibold"
                                                    style={{ color: 'var(--color-admin-primary)' }}>#{order.queue_number}</span>
                                            )}
                                            <span className="text-xs" style={css.muted}>
                                                {new Date(order.created_at).toLocaleString('zh-TW', {
                                                    month: 'numeric', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                        <p className="text-xs mt-0.5 truncate" style={css.muted}>
                                            {order.order_items.map(i => `${i.products.name}×${i.quantity}`).join('、')}
                                        </p>
                                    </div>

                                    {/* Amount + expand indicator */}
                                    <div className="shrink-0 text-right flex items-center gap-2">
                                        <p className="text-sm font-bold tabular-nums" style={css.text}>
                                            NT$ {order.total_amount.toLocaleString()}
                                        </p>
                                        <span className="text-xs" style={css.muted}>{isExpanded ? '▲' : '▼'}</span>
                                    </div>
                                </button>

                                {/* Expanded detail panel */}
                                {isExpanded && (
                                    <div className="border-t px-4 pb-4 pt-3 space-y-4" style={css.border}>

                                        {/* Order items breakdown */}
                                        <div>
                                            <p className="text-xs font-semibold mb-2" style={css.muted}>訂購品項</p>
                                            <div className="space-y-1">
                                                {order.order_items.map((item, i) => (
                                                    <div key={i} className="flex justify-between text-sm">
                                                        <span style={css.muted}>{item.products.name} × {item.quantity}</span>
                                                        <span style={css.text}>NT$ {item.unit_price * item.quantity}</span>
                                                    </div>
                                                ))}
                                                {order.pickup_fee > 0 && (
                                                    <div className="flex justify-between text-xs pt-1" style={{ borderTop: '1px solid var(--color-admin-border)' }}>
                                                        <span style={css.muted}>取貨費用</span>
                                                        <span style={css.muted}>NT$ {order.pickup_fee}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-sm font-bold pt-1" style={{ borderTop: '1px solid var(--color-admin-border)' }}>
                                                    <span style={css.text}>總計</span>
                                                    <span style={css.text}>NT$ {order.total_amount}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pickup method + payment method */}
                                        <div className="grid grid-cols-2 gap-x-4">
                                            <div>
                                                <p className="text-xs font-semibold mb-1" style={css.muted}>取貨方式</p>
                                                <p className="text-sm" style={css.text}>
                                                    {order.pickup_options?.name ?? '—'}
                                                </p>
                                                {order.pickup_fee > 0 && (
                                                    <p className="text-xs" style={css.muted}>+NT$ {order.pickup_fee}</p>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold mb-1" style={css.muted}>付款方式</p>
                                                <p className="text-sm" style={css.text}>
                                                    {order.payment_method === 'bank_transfer' ? '銀行匯款' : '現金付款'}
                                                </p>
                                                {order.remit_last5 && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full"
                                                        style={{ backgroundColor: '#EDE9FE', color: '#5B21B6' }}>
                                                        後五碼 {order.remit_last5}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Contact info */}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                            <div>
                                                <p className="text-xs font-semibold mb-1" style={css.muted}>訂購人</p>
                                                <p className="text-xs" style={css.muted}>{order.customer_name}</p>
                                                <p className="text-xs" style={css.muted}>{order.customer_phone}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold mb-1" style={css.muted}>收貨人</p>
                                                {sameRecipient ? (
                                                    <p className="text-xs" style={css.muted}>同訂購人</p>
                                                ) : (
                                                    <>
                                                        <p className="text-xs" style={css.muted}>{order.recipient_name}</p>
                                                        <p className="text-xs" style={css.muted}>{order.recipient_phone}</p>
                                                    </>
                                                )}
                                                {order.recipient_address && (
                                                    <p className="text-xs mt-1" style={css.muted}>{order.recipient_address}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        {(order.customer_note || order.admin_note) && (
                                            <div className="space-y-1">
                                                {order.customer_note && (
                                                    <p className="text-xs" style={css.muted}>
                                                        <span className="font-semibold">客戶備註：</span>{order.customer_note}
                                                    </p>
                                                )}
                                                {order.admin_note && (
                                                    <p className="text-xs" style={css.muted}>
                                                        <span className="font-semibold">店家備註：</span>{order.admin_note}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            )
                        })}
                    </div>
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={total}
                        limit={LIMIT}
                        onChange={handlePageChange}
                    />
                </>
            )}
        </div>
    )
}
