'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import AdminError from '@/components/admin/AdminError'
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
    customer_note: string | null
    admin_note: string | null
    customer_name: string
    customer_phone: string
    recipient_name: string
    recipient_phone: string
    recipient_address: string | null
    pickup_options: { name: string } | null
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

// Reusable button class fragments
const btn = {
    // Solid colored buttons (primary, green, red)
    solid: 'cursor-pointer transition hover:brightness-90 active:brightness-75 disabled:hover:brightness-100 disabled:active:brightness-100',
    // Surface / border buttons (light background)
    surface: 'cursor-pointer transition hover:brightness-95 active:brightness-90 disabled:hover:brightness-100 disabled:active:brightness-100',
    // Inline text link buttons
    link: 'cursor-pointer transition hover:opacity-70',
} as const

const PAGE_LIMIT = 20

export default function AdminDashBoard() {
    const [orders, setOrders] = useState<Order[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [dataLoaded, setDataLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [actionState, setActionState] = useState<{
        orderId: string
        action: 'reject' | 'cancel'
        reason: string
    } | null>(null)
    const [adminNoteInputs, setAdminNoteInputs] = useState<Record<string, string>>({})
    const [adminNoteEditing, setAdminNoteEditing] = useState<string | null>(null)
    const [adminNoteSaving, setAdminNoteSaving] = useState<string | null>(null)

    const [filterStatus, setFilterStatus] = useState('')
    const [filterSessionId, setFilterSessionId] = useState('')
    const [filterProductId, setFilterProductId] = useState('')
    const [sessions, setSessions] = useState<Session[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [page, setPage] = useState(1)

    const { combine } = useMinLoading(1000)
    const isLoading = combine(dataLoaded)

    const fetchOrders = useCallback(async (p: number, scroll = false) => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({ page: String(p), limit: String(PAGE_LIMIT) })
            if (filterStatus) params.set('status', filterStatus)
            if (filterSessionId) params.set('sessionId', filterSessionId)
            if (filterProductId) params.set('productId', filterProductId)

            const res = await adminFetch(`/api/admin/orders?${params}`)
            const body = await res.json()
            if (body.data) {
                setOrders(body.data)
                setTotal(body.total ?? 0)
                setTotalPages(body.totalPages ?? 0)
                const notes: Record<string, string> = {}
                body.data.forEach((o: Order) => { notes[o.id] = o.admin_note ?? '' })
                setAdminNoteInputs(notes)
                if (scroll) {
                    requestAnimationFrame(() => {
                        document.getElementById('admin-main')?.scrollTo({ top: 0, behavior: 'smooth' })
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                    })
                }
            } else {
                setError(body.message ?? '載入失敗')
            }
        } catch (e: any) {
            setError(e.message ?? '載入失敗')
        } finally {
            setLoading(false)
            setDataLoaded(true)
        }
    }, [filterStatus, filterSessionId, filterProductId])

    // 初次載入
    useEffect(() => {
        fetchOrders(1)
        adminFetch('/api/admin/sessions')
            .then(r => r.json())
            .then(body => setSessions(body.data ?? []))
    }, [])

    // filter 改變時重設到第 1 頁並重新 fetch
    useEffect(() => {
        setPage(1)
        fetchOrders(1)
    }, [filterStatus, filterSessionId, filterProductId])

    // 選 session 後載入商品
    useEffect(() => {
        setFilterProductId('')
        setProducts([])
        if (!filterSessionId) return
        adminFetch(`/api/admin/sessions/${filterSessionId}`)
            .then(r => r.json())
            .then(body => setProducts(body.data?.products ?? []))
    }, [filterSessionId])

    async function saveAdminNote(orderId: string) {
        setAdminNoteSaving(orderId)
        try {
            await adminFetch(`/api/admin/orders/${orderId}/note`, {
                method: 'PATCH',
                body: JSON.stringify({ note: adminNoteInputs[orderId]?.trim() || null })
            })
            setOrders(prev => prev.map(o =>
                o.id === orderId ? { ...o, admin_note: adminNoteInputs[orderId]?.trim() || null } : o
            ))
            setAdminNoteEditing(null)
        } finally {
            setAdminNoteSaving(null)
        }
    }

    async function handleAction(orderId: string, action: string, body?: object) {
        await adminFetch(`/api/admin/orders/${orderId}/${action}`, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined
        })
        fetchOrders(page)
    }

    function handlePageChange(p: number) {
        setPage(p)
        fetchOrders(p, true)
    }

    const hasFilter = filterStatus || filterSessionId || filterProductId

    if (isLoading) return <AdminSpinner />
    if (error) return <AdminError error={error} onRetry={() => fetchOrders(page)} />

    return (
        <div className="p-6 max-w-3xl mx-auto" style={{ minHeight: '100vh' }}>

            {/* 頁首 */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-xl font-semibold" style={css.text}>訂單管理</h1>
                    <p className="text-sm mt-0.5" style={css.muted}>
                        {total} 筆{hasFilter ? '（篩選結果）' : '進行中'}
                    </p>
                </div>
                <button
                    onClick={() => fetchOrders(page)}
                    disabled={loading}
                    className={`text-sm px-4 py-2 rounded-lg border disabled:opacity-50 ${btn.surface}`}
                    style={css.surface}
                >
                    <span style={css.muted}>重新整理</span>
                </button>
            </div>

            {/* 篩選列 */}
            <div className="rounded-xl border p-3 mb-4 space-y-2" style={css.surface}>
                <div className="flex flex-col md:flex-row gap-2">
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-xs md:flex-1 w-full cursor-pointer"
                        style={css.surface}
                    >
                        <option value="">所有狀態</option>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                        ))}
                    </select>

                    <select
                        value={filterSessionId}
                        onChange={e => setFilterSessionId(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-xs md:flex-1 w-full cursor-pointer"
                        style={css.surface}
                    >
                        <option value="">所有開單</option>
                        {sessions.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                    </select>

                    <select
                        value={filterProductId}
                        onChange={e => setFilterProductId(e.target.value)}
                        disabled={!filterSessionId}
                        className="border rounded-lg px-3 py-2 text-xs md:flex-1 w-full disabled:opacity-40 cursor-pointer"
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
                        onClick={() => { setFilterStatus(''); setFilterSessionId(''); setFilterProductId('') }}
                        className={`text-xs px-3 py-1 rounded-lg border ${btn.surface}`}
                        style={css.surface}
                    >
                        <span style={css.muted}>清除篩選</span>
                    </button>
                )}
            </div>

            {orders.length === 0 && !loading ? (
                <div className="p-12 text-center">
                    <p className="text-sm" style={css.muted}>
                        {hasFilter ? '沒有符合篩選條件的訂單' : '目前沒有進行中的訂單'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        {orders.map((order) => (
                            <div key={order.id}
                                className="rounded-xl border overflow-hidden"
                                style={css.surface}>

                                {/* 主要資訊列 */}
                                <div className="p-4 flex flex-wrap md:flex-nowrap items-start gap-3">

                                    {/* 狀態 */}
                                    <div className="shrink-0 pt-0.5">
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
                                        <div className="mt-0.5 space-y-0.5">
                                            {order.order_items.map((i, idx) => (
                                                <p key={idx} className="text-sm" style={css.muted}>
                                                    {i.products.name} × {i.quantity}
                                                </p>
                                            ))}
                                        </div>
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
                                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white ${btn.solid}`}
                                                style={{ backgroundColor: 'var(--color-admin-primary)' }}>接單</button>
                                            <button onClick={() => setActionState({ orderId: order.id, action: 'reject', reason: '' })}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${btn.solid}`}
                                                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>拒絕</button>
                                        </>)}
                                        {order.status === 'in_production' && (<>
                                            <button onClick={() => handleAction(order.id, 'ready')}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white ${btn.solid}`}
                                                style={{ backgroundColor: '#16A34A' }}>製作完成</button>
                                            <button onClick={() => setActionState({ orderId: order.id, action: 'cancel', reason: '' })}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${btn.solid}`}
                                                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>取消</button>
                                        </>)}
                                        {order.status === 'pending_payment' && order.payment_method === 'cash' && (
                                            <button onClick={() => handleAction(order.id, 'confirm-payment')}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white ${btn.solid}`}
                                                style={{ backgroundColor: '#16A34A' }}>確認收現</button>
                                        )}
                                        {order.status === 'payment_submitted' && (
                                            <button onClick={() => handleAction(order.id, 'confirm-payment')}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white ${btn.solid}`}
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
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${btn.solid}`}
                                            style={{ backgroundColor: '#DC2626' }}>確認</button>
                                        <button onClick={() => setActionState(null)}
                                            className={`px-3 py-1.5 rounded-lg text-xs border ${btn.surface}`}
                                            style={css.surface}>取消</button>
                                    </div>
                                )}

                                {/* Contact info */}
                                <div className="px-4 pb-3 border-t pt-3 space-y-2" style={css.border}>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        <div>
                                            <p className="text-xs font-semibold mb-0.5" style={css.muted}>訂購人</p>
                                            <p className="text-xs" style={css.text}>{order.customer_name}</p>
                                            <p className="text-xs" style={css.muted}>{order.customer_phone}</p>
                                            {order.pickup_options && (
                                                <p className="text-xs" style={css.muted}>
                                                    <span className="font-semibold">取貨方式：</span>{order.pickup_options.name}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold mb-0.5" style={css.muted}>收貨人</p>
                                            <p className="text-xs" style={css.text}>{order.recipient_name}</p>
                                            <p className="text-xs" style={css.muted}>{order.recipient_phone}</p>
                                            {order.recipient_address && (
                                                <p className="text-xs mt-0.5" style={css.muted}>{order.recipient_address}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="px-4 pb-4 border-t pt-3 space-y-2" style={css.border}>
                                    {order.customer_note && (
                                        <p className="text-xs" style={css.muted}>
                                            <span className="font-semibold">客戶備註：</span>{order.customer_note}
                                        </p>
                                    )}

                                    {adminNoteEditing === order.id ? (
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="text"
                                                value={adminNoteInputs[order.id] ?? ''}
                                                onChange={e => setAdminNoteInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                placeholder="店家備註（僅內部可見）"
                                                className="w-full border rounded-lg px-3 py-1.5 text-xs"
                                                style={css.surface}
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => saveAdminNote(order.id)}
                                                    disabled={adminNoteSaving === order.id}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 ${btn.solid}`}
                                                    style={css.primary}>
                                                    {adminNoteSaving === order.id ? '儲存中...' : '儲存'}
                                                </button>
                                                <button
                                                    onClick={() => setAdminNoteEditing(null)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs border ${btn.surface}`}
                                                    style={css.surface}>取消</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs flex-1" style={css.muted}>
                                                <span className="font-semibold">店家備註：</span>
                                                {order.admin_note ?? <span className="italic">尚未填寫</span>}
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setAdminNoteInputs(prev => ({ ...prev, [order.id]: order.admin_note ?? '' }))
                                                    setAdminNoteEditing(order.id)
                                                }}
                                                className={`text-xs underline underline-offset-2 shrink-0 ${btn.link}`}
                                                style={{ color: 'var(--color-admin-primary)' }}>
                                                {order.admin_note ? '編輯' : '新增'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={total}
                        limit={PAGE_LIMIT}
                        onChange={handlePageChange}
                    />
                </>
            )}
        </div>
    )
}
