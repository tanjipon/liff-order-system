'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import { useMinLoading } from '@/hooks/useMinLoading'
import Pagination from '@/components/admin/Pagination'

type Order = {
    id: string
    status: string
    session_id: string
    line_display_name: string
    total_amount: number
    queue_number: number | null
    payment_method: string
    remit_last5: string | null
    created_at: string
    order_items: {
        product_id: string
        quantity: number
        unit_price: number
        products: { name: string }
    }[]
}

type Session = { id: string; title: string }
type Product = { id: string; name: string }

const STATUS_LABEL: Record<string, string> = {
    pending: '待確認',
    in_production: '製作中',
    pending_payment: '待付款',
    payment_submitted: '付款確認中',
}

const STATUS_STYLE: Record<string, { backgroundColor: string; color: string }> = {
    pending: { backgroundColor: '#FEF9C3', color: '#854D0E' },
    in_production: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
    pending_payment: { backgroundColor: '#FFEDD5', color: '#9A3412' },
    payment_submitted: { backgroundColor: '#EDE9FE', color: '#5B21B6' },
}

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
    primary: { backgroundColor: 'var(--color-admin-primary)', color: '#fff' },
    border: { borderColor: 'var(--color-admin-border)' },
} as const

export default function AdminDashBoard() {
    const [orders, setOrders] = useState<Order[]>([])
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [actionState, setActionState] = useState<{
        orderId: string
        action: 'reject' | 'cancel'
        reason: string
    } | null>(null)

    // filters
    const [filterStatus, setFilterStatus] = useState('')
    const [filterSessionId, setFilterSessionId] = useState('')
    const [filterProductId, setFilterProductId] = useState('')
    const [sessions, setSessions] = useState<Session[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [page, setPage] = useState(1)

    const { combine } = useMinLoading(1000)
    const isLoading = combine(dataLoaded)

    async function loadOrders() {
        try {
            const res = await adminFetch('/api/admin/orders')
            const body = await res.json()
            if (body.data) setOrders(body.data)
            else setError(body.message ?? '載入失敗')
        } catch {
            setError('載入失敗')
        } finally {
            setDataLoaded(true)
        }
    }

    useEffect(() => {
        loadOrders()
        adminFetch('/api/admin/sessions')
            .then(r => r.json())
            .then(body => setSessions(body.data ?? []))
    }, [])

    useEffect(() => {
        setFilterProductId('')
        setProducts([])
        if (!filterSessionId) return
        adminFetch(`/api/admin/sessions/${filterSessionId}`)
            .then(r => r.json())
            .then(body => setProducts(body.data?.products ?? []))
    }, [filterSessionId])

    async function handleAction(orderId: string, action: string, body?: object) {
        await adminFetch(`/api/admin/orders/${orderId}/${action}`, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined
        })
        loadOrders()
    }

    if (isLoading) return <AdminSpinner />
    if (error) return (
        <div className="p-8 text-sm" style={{ color: '#DC2626' }}>{error}</div>
    )

    const ACTIVE_STATUSES = ['pending', 'in_production', 'pending_payment', 'payment_submitted']
    const PAGE_LIMIT = 20

    let filteredOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status))
    if (filterStatus) filteredOrders = filteredOrders.filter(o => o.status === filterStatus)
    if (filterSessionId) filteredOrders = filteredOrders.filter(o => o.session_id === filterSessionId)
    if (filterProductId) filteredOrders = filteredOrders.filter(o =>
        o.order_items.some((i: any) => i.product_id === filterProductId)
    )

    const hasFilter = filterStatus || filterSessionId || filterProductId
    const totalActive = orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length

    const totalPages = Math.ceil(filteredOrders.length / PAGE_LIMIT)
    const pagedOrders = filteredOrders.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT)

    function handlePageChange(p: number) {
        setPage(p)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <div className="p-6 max-w-3xl mx-auto" style={{ minHeight: '100vh' }}>

            {/* 頁首 */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-xl font-semibold" style={css.text}>訂單管理</h1>
                    <p className="text-sm mt-0.5" style={css.muted}>
                        {hasFilter
                            ? `篩選結果 ${filteredOrders.length} 筆（共 ${totalActive} 筆進行中）`
                            : `${totalActive} 筆進行中`
                        }
                    </p>
                </div>
                <button
                    onClick={loadOrders}
                    className="text-sm px-4 py-2 rounded-lg border"
                    style={css.surface}
                >
                    <span style={css.muted}>重新整理</span>
                </button>
            </div>

            {/* 篩選列 */}
            <div className="rounded-xl border p-3 mb-4 space-y-2" style={css.surface}>
                <div className="flex flex-col md:flex-row gap-2">
                    {/* 狀態 */}
                    <select
                        value={filterStatus}
                        onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                        className="border rounded-lg px-3 py-2 text-xs md:flex-1 w-full"
                        style={css.surface}
                    >
                        <option value="">所有狀態</option>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                        ))}
                    </select>

                    {/* 開單 */}
                    <select
                        value={filterSessionId}
                        onChange={e => { setFilterSessionId(e.target.value); setPage(1) }}
                        className="border rounded-lg px-3 py-2 text-xs md:flex-1 w-full"
                        style={css.surface}
                    >
                        <option value="">所有開單</option>
                        {sessions.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                    </select>

                    {/* 商品 */}
                    <select
                        value={filterProductId}
                        onChange={e => { setFilterProductId(e.target.value); setPage(1) }}
                        disabled={!filterSessionId}
                        className="border rounded-lg px-3 py-2 text-xs md:flex-1 w-full disabled:opacity-40"
                        style={css.surface}
                    >
                        <option value="">所有商品</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {hasFilter && (
                    <button
                        onClick={() => { setFilterStatus(''); setFilterSessionId(''); setFilterProductId(''); setPage(1) }}
                        className="text-xs px-3 py-1 rounded-lg border"
                        style={css.surface}
                    >
                        <span style={css.muted}>清除篩選</span>
                    </button>
                )}
            </div>

            {filteredOrders.length === 0 ? (
                <div className="p-12 text-center">
                    <p className="text-sm" style={css.muted}>
                        {hasFilter ? '沒有符合篩選條件的訂單' : '目前沒有進行中的訂單'}
                    </p>
                </div>
            ) : (
                <>
                <div className="space-y-3">
                    {pagedOrders.map((order) => (
                        <div key={order.id}
                            className="rounded-xl border overflow-hidden"
                            style={css.surface}>

                            {/* 主要資訊列 */}
                            <div className="p-4 flex flex-wrap md:flex-nowrap items-center gap-3">

                                {/* 狀態 */}
                                <div className="shrink-0">
                                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                                        style={STATUS_STYLE[order.status]}>
                                        {STATUS_LABEL[order.status]}
                                    </span>
                                </div>

                                {/* 客戶 + 品項 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-sm" style={css.text}>{order.line_display_name}</p>
                                        {order.queue_number && (
                                            <span className="text-xs font-mono font-semibold"
                                                style={{ color: 'var(--color-admin-primary)' }}>#{order.queue_number}</span>
                                        )}
                                        <span className="text-xs" style={css.muted}>
                                            {new Date(order.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm mt-0.5 truncate" style={css.muted}>
                                        {order.order_items.map(i => `${i.products.name}×${i.quantity}`).join('、')}
                                    </p>
                                    <p className="text-sm font-bold" style={css.text}>NT$ {order.total_amount}</p>
                                    {order.payment_method === 'bank_transfer' && order.remit_last5 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: '#EDE9FE', color: '#5B21B6' }}>
                                            後五碼 {order.remit_last5}
                                        </span>
                                    )}
                                </div>

                                {/* 操作按鈕 */}
                                <div className="shrink-0 flex gap-3 flex-wrap">
                                    {order.status === 'pending' && (<>
                                        <button onClick={() => handleAction(order.id, 'accept')}
                                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                                            style={{ backgroundColor: 'var(--color-admin-primary)' }}>接單</button>
                                        <button onClick={() => setActionState({ orderId: order.id, action: 'reject', reason: '' })}
                                            className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                                            style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>拒絕</button>
                                    </>)}
                                    {order.status === 'in_production' && (<>
                                        <button onClick={() => handleAction(order.id, 'ready')}
                                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                                            style={{ backgroundColor: '#16A34A' }}>製作完成</button>
                                        <button onClick={() => setActionState({ orderId: order.id, action: 'cancel', reason: '' })}
                                            className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                                            style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>取消</button>
                                    </>)}
                                    {order.status === 'pending_payment' && order.payment_method === 'cash' && (
                                        <button onClick={() => handleAction(order.id, 'confirm-payment')}
                                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                                            style={{ backgroundColor: '#16A34A' }}>確認收現</button>
                                    )}
                                    {order.status === 'payment_submitted' && (
                                        <button onClick={() => handleAction(order.id, 'confirm-payment')}
                                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                                            style={{ backgroundColor: '#16A34A' }}>確認付款</button>
                                    )}
                                </div>
                            </div>

                            {/* 原因輸入框（獨立一行） */}
                            {actionState?.orderId === order.id && (
                                <div className="px-4 pb-4 flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={actionState.reason}
                                        onChange={e => setActionState({ ...actionState, reason: e.target.value })}
                                        placeholder={actionState.action === 'reject' ? '請輸入拒絕原因' : '請輸入取消原因'}
                                        className="flex-1 border rounded-lg px-3 py-1.5 text-xs"
                                        style={css.surface}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!actionState.reason.trim()) return
                                            handleAction(actionState.orderId, actionState.action, { reason: actionState.reason })
                                            setActionState(null)
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                                        style={{ backgroundColor: '#DC2626' }}>確認</button>
                                    <button onClick={() => setActionState(null)}
                                        className="px-3 py-1.5 rounded-lg text-xs border"
                                        style={css.surface}>取消</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={filteredOrders.length}
                    limit={PAGE_LIMIT}
                    onChange={handlePageChange}
                />
                </>
            )}
        </div>
    )
}
