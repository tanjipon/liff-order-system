'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'
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
    order_number: number | null
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
    sessions: { title: string } | null
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
    completed: '已完成',
    cancelled: '已取消',
}

const STATUS_STYLE: Record<string, { backgroundColor: string; color: string }> = {
    pending: { backgroundColor: '#FEF9C3', color: '#854D0E' },
    in_production: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
    pending_payment: { backgroundColor: '#FFEDD5', color: '#9A3412' },
    payment_submitted: { backgroundColor: '#EDE9FE', color: '#5B21B6' },
    completed: { backgroundColor: '#DCFCE7', color: '#166534' },
    cancelled: { backgroundColor: '#F3F4F6', color: '#6B7280' },
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
    const [filterProductIds, setFilterProductIds] = useState<string[]>([])
    const [filterOrderNumber, setFilterOrderNumber] = useState('')
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
            if (filterOrderNumber) params.set('orderNumber', filterOrderNumber)
            if (filterStatus) params.set('status', filterStatus)
            if (filterSessionId) params.set('sessionId', filterSessionId)
            if (filterProductIds.length > 0) params.set('productIds', filterProductIds.join(','))

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
    }, [filterStatus, filterSessionId, filterProductIds, filterOrderNumber])

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
    }, [filterStatus, filterSessionId, filterProductIds, filterOrderNumber])

    // 選 session 後載入商品
    useEffect(() => {
        setFilterProductIds([])
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

    const hasFilter = filterStatus || filterSessionId || filterProductIds.length > 0 || filterOrderNumber

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
                <div className="relative">
                    <input
                        type="number"
                        min="1"
                        value={filterOrderNumber}
                        onChange={e => setFilterOrderNumber(e.target.value)}
                        placeholder="搜尋單號（輸入數字）"
                        className="border rounded-lg pl-3 pr-9 text-xs w-full h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        style={css.surface}
                    />
                    {filterOrderNumber ? (
                        <button
                            type="button"
                            onClick={() => setFilterOrderNumber('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                            style={{ color: 'var(--color-admin-muted)' }}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--color-admin-muted)' }} />
                    )}
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="border rounded-lg px-3 text-xs md:flex-1 w-full cursor-pointer h-9 appearance-none"
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
                        className="border rounded-lg px-3 text-xs md:flex-1 w-full cursor-pointer h-9 appearance-none"
                        style={css.surface}
                    >
                        <option value="">所有開單</option>
                        {sessions.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                    </select>

                    {filterSessionId && products.length > 0 && (
                        <div className="border rounded-lg px-3 py-2 md:flex-1 space-y-1.5" style={css.surface}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs" style={css.muted}>商品篩選</span>
                                {filterProductIds.length > 0 && (
                                    <button type="button" onClick={() => setFilterProductIds([])} className="text-xs cursor-pointer" style={css.muted}>清除</button>
                                )}
                            </div>
                            {products.map(p => (
                                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={filterProductIds.includes(p.id)}
                                        onChange={e => setFilterProductIds(prev =>
                                            e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                                        )}
                                    />
                                    <span className="text-xs" style={css.text}>{p.name}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {hasFilter && (
                    <button
                        onClick={() => { setFilterStatus(''); setFilterSessionId(''); setFilterProductIds([]); setFilterOrderNumber('') }}
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
                        {orders.map((order) => {
                            const sameRecipient =
                                order.recipient_name === order.customer_name &&
                                order.recipient_phone === order.customer_phone

                            return (
                            <div key={order.id}
                                className="rounded-xl border overflow-hidden"
                                style={css.surface}>

                                {/* Header row */}
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
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {order.order_number && (
                                                <span className="text-xs font-mono" style={css.muted}>
                                                    #{String(order.order_number).padStart(4, '0')}
                                                </span>
                                            )}
                                            <span className="text-xs" style={css.muted}>
                                                {new Date(order.created_at).toLocaleString('zh-TW', {
                                                    year: 'numeric', month: 'numeric', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                        {order.sessions?.title && (
                                            <p className="text-xs mt-0.5" style={css.muted}>{order.sessions.title}</p>
                                        )}
                                    </div>

                                    {/* 操作按鈕 */}
                                    <div className="shrink-0 flex gap-2 flex-wrap justify-end">
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

                                {/* Detail panel — always visible */}
                                <div className="border-t px-4 pb-4 pt-3 space-y-4" style={css.border}>

                                        {/* 訂購品項 */}
                                        <div>
                                            <p className="text-xs font-semibold mb-2" style={css.muted}>訂購品項</p>
                                            <div className="space-y-1">
                                                {order.order_items.map((item, i) => (
                                                    <div key={i} className="flex justify-between text-sm">
                                                        <span style={css.muted}>{item.products.name} × {item.quantity}</span>
                                                        <span style={css.text}>NT$ {item.unit_price * item.quantity}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between text-sm font-bold pt-1" style={{ borderTop: '1px solid var(--color-admin-border)' }}>
                                                    <span style={css.text}>總計</span>
                                                    <span style={css.text}>NT$ {order.total_amount}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 取貨 + 付款 */}
                                        <div className="grid grid-cols-2 gap-x-4">
                                            <div>
                                                <p className="text-xs font-semibold mb-1" style={css.muted}>取貨方式</p>
                                                <p className="text-sm" style={css.text}>{order.pickup_options?.name ?? '—'}</p>
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

                                        {/* 聯絡資訊 */}
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

                                        {/* 備注 */}
                                        <div className="space-y-2">
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
                                        {/* 原因輸入框 */}
                                        {actionState?.orderId === order.id && (
                                            <div className="flex gap-2 items-center">
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
                                    </div>
                            </div>
                            )
                        })}
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
