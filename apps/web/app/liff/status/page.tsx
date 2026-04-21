'use client'

import { useEffect, useState } from 'react'

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

const STATUS_COLOR: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    in_production: 'bg-blue-100 text-blue-700',
    pending_payment: 'bg-orange-100 text-orange-700',
    payment_submitted: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
}

export default function StatusPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
    const [editQuantities, setEditQuantities] = useState<Record<string, number>>({})
    const [submitting, setSubmitting] = useState(false)

    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)

    const [remitInputs, setRemitInputs] = useState<Record<string, string>>({})
    const [remitSubmitting, setRemitSubmitting] = useState(false)

    useEffect(() => {
        fetch('/api/orders', {
            headers: { 'x-liff-token': 'mock-token' }
        })
            .then(res => res.json())
            .then(body => {
                if (body.data) setOrders(body.data)
                else setError(body.message ?? '載入失敗')
            })
            .catch(() => setError('載入失敗，請稍後再試'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="p-4">載入中...</div>
    if (error) return <div className="p-4 text-red-500">{error}</div>
    if (orders.length === 0) return <div className="p-4 text-gray-500">目前沒有訂單紀錄</div>

    function startEdit(order: Order) {
        setEditingOrderId(order.id)

        const init: Record<string, number> = {}
        order.order_items.forEach(item => {
            init[item.products.name] = item.quantity
        })
        setEditQuantities(init)
    }

    async function submitEdit(order: Order, sessionProducts: { id: string, name: string, stock_qty: number }[]) {
        setSubmitting(true)
        try {
            const items = sessionProducts
                .filter(p => (editQuantities[p.name] ?? 0) > 0)
                .map(p => ({ product_id: p.id, quantity: editQuantities[p.name] }))

            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-liff-token': 'mock-token'
                },
                body: JSON.stringify({ items },)
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
                headers: {
                    'x-liff-token': 'mock-token'
                }
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
        if (!remitLast5 || remitLast5.length != 5) return

        setRemitSubmitting(true)
        try {
            const res = await fetch(`/api/orders/${orderId}/remit`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-liff-token': 'mock-token'
                },
                body: JSON.stringify({ remitLast5 })
            })

            if (!res.ok) {
                const body = await res.json()
                console.log('remit error:', body)  // 加這行
                throw new Error(body.message ?? '送出失敗')
            }

            window.location.reload()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setRemitSubmitting(false)
        }
    }

    return (
        <div className="p-4 max-w-md mx-auto space-y-4">
            <h1 className="text-xl font-bold">我的訂單</h1>

            {orders.map(order => (
                <div key={order.id} className="border rounded-lg p-4 space-y-3">

                    {/* status label */}
                    <div className="flex justify-between items-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status]}`}>
                            {STATUS_LABEL[order.status]}
                        </span>
                        {order.queue_number && (
                            <span className="text-sm text-gray-500">隊伍號碼 #{order.queue_number}</span>
                        )}
                    </div>

                    {/* items list */}
                    {order.status === 'pending' && editingOrderId === order.id ? (
                        // editing mode
                        <div className="space-y-2">
                            {order.order_items.map(item => (
                                <div key={item.product_id} className="flex items-center justify-between text-sm">
                                    <span>{item.products.name}</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setEditQuantities(prev => ({
                                            ...prev,
                                            [item.products.name]: Math.max(0, (prev[item.products.name] ?? 0) - 1)
                                        }))} className="w-7 h-7 rounded-full border">−</button>
                                        <span className="w-5 text-center">{editQuantities[item.products.name] ?? 0}</span>
                                        <button onClick={() => setEditQuantities(prev => ({
                                            ...prev,
                                            [item.products.name]: (prev[item.products.name] ?? 0) + 1
                                        }))} className="w-7 h-7 rounded-full border">+</button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => submitEdit(order, order.order_items.map(i => ({
                                        id: i.product_id,
                                        name: i.products.name,
                                        stock_qty: 999,
                                    })))}
                                    disabled={submitting || Object.values(editQuantities).every(q => q === 0)}
                                    className="flex-1 py-2 bg-green-500 text-white rounded text-sm disabled:opacity-40"
                                >送出修改</button>
                                <button
                                    onClick={() => setEditingOrderId(null)}
                                    className="flex-1 py-2 border rounded text-sm"
                                >取消</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {order.order_items.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span>{item.products.name} × {item.quantity}</span>
                                    <span>NT$ {item.unit_price * item.quantity}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* pending status shows edit ane cancel button (view mode) */}
                    {order.status === 'pending' && editingOrderId !== order.id && (
                        <div className="space-y-2">
                            <button
                                onClick={() => startEdit(order)}
                                className="text-sm text-blue-500 underline"
                            >修改訂單</button>

                            {cancellingOrderId === order.id ? (
                                <div className="space-y-2">
                                    <p className="text-sm text-red-500">確定要取消這筆訂單嗎？</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => submitCancel(order.id)}
                                            disabled={submitting}
                                            className="flex-1 py-2 bg-red-500 text-white rounded text-sm disabled:opacity-40"
                                        >確認取消</button>
                                        <button
                                            onClick={() => setCancellingOrderId(null)}
                                            className="flex-1 py-2 border rounded text-sm"
                                        >我再想想</button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setCancellingOrderId(order.id)}
                                    className="text-sm text-red-400 underline"
                                >取消訂單</button>
                            )}
                        </div>
                    )}

                    {/* total amount */}
                    <div className="border-t pt-2 text-sm space-y-1">
                        {order.pickup_fee > 0 && (
                            <div className="flex justify-between text-gray-500">
                                <span>取貨費用</span>
                                <span>NT$ {order.pickup_fee}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold">
                            <span>總計</span>
                            <span>NT$ {order.total_amount}</span>
                        </div>

                        {order.status === 'pending' && (
                            <p className="text-xs text-gray-400">等待店家確認中，請耐心等候</p>
                        )}
                        {order.status === 'in_production' && (
                            <p className="text-xs text-blue-500">店家已接單，正在為您製作</p>
                        )}
                        {order.status === 'pending_payment' && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-orange-500">製作完成！請完成付款</p>

                                {/* 匯款資訊 */}
                                <div className="bg-orange-50 rounded p-3 text-sm space-y-1">
                                    <p>銀行代碼：{process.env.NEXT_PUBLIC_BANK_CODE}</p>
                                    <p>帳號：{process.env.NEXT_PUBLIC_BANK_ACCOUNT}</p>
                                    <p>戶名：{process.env.NEXT_PUBLIC_BANK_HOLDER}</p>
                                    <p className="font-bold text-orange-600">匯款金額：NT$ {order.total_amount}</p>
                                </div>

                                {/* 填入後五碼 */}
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-600">匯款完成後，請填入帳號後五碼：</p>
                                    <input
                                        type="text"
                                        maxLength={5}
                                        placeholder="例如：12345"
                                        value={remitInputs[order.id] ?? ''}
                                        onChange={e => setRemitInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                        className="w-full border rounded px-3 py-2 text-sm"
                                    />
                                    <button
                                        onClick={() => submitRemit(order.id)}
                                        disabled={
                                            remitSubmitting ||
                                            (remitInputs[order.id]?.trim().length ?? 0) !== 5
                                        }
                                        className="w-full py-2 bg-orange-500 text-white rounded text-sm disabled:opacity-40"
                                    >送出匯款資訊</button>
                                </div>
                            </div>
                        )}
                        {order.status === 'payment_submitted' && order.remit_last5 && (
                            <p className="text-xs text-purple-500">已收到您的匯款後五碼：{order.remit_last5}</p>
                        )}
                        {order.status === 'completed' && (
                            <p className="text-xs text-green-500">感謝您的購買！</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}