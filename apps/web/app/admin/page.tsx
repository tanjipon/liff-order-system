'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/auth/adminClient'
import Link from 'next/link'

type Order = {
    id: string
    status: string
    line_display_name: string
    total_amount: number
    queue_number: number | null
    payment_method: string
    remit_last5: string | null
    created_at: string
    order_items: {
        quantity: number
        unit_price: number
        products: { name: string }
    }[]
}

const STATUS_LABEL: Record<string, string> = {
    pending: '待確認',
    in_production: '製作中',
    pending_payment: '待付款',
    payment_submitted: '付款確認中',
}

const STATUS_COLOR: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    in_production: 'bg-blue-100 text-blue-700',
    pending_payment: 'bg-orange-100 text-orange-700',
    payment_submitted: 'bg-purple-100 text-purple-700',
}

export default function AdminDashBoard() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [actionState, setActionState] = useState<{
        orderId: string
        action: 'reject' | 'cancel'
        reason: string
    } | null>(null)

    async function loadOrders() {
        try {
            const res = await adminFetch('/api/admin/orders')
            const body = await res.json()
            if (body.data) setOrders(body.data)
            else setError(body.message ?? '載入失敗')
        } catch {
            setError('載入失敗')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadOrders() }, [])

    async function handleAction(orderId: string, action: string, body?: object) {
        await adminFetch(`/api/admin/orders/${orderId}/${action}`, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined
        })
        loadOrders() // reload
    }

    if (loading) return <div className="p-6">載入中...</div>
    if (error) return <div className="p-6 text-red-500">{error}</div>

    const activeOrders = orders.filter(o =>
        ['pending', 'in_production', 'pending_payment', 'payment_submitted'].includes(o.status)
    )

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">訂單管理</h1>
                <div className="flex gap-2">
                    <Link href="/admin/sessions" className="text-sm text-gray-500 border rounded px-3 py-1">
                        開單管理
                    </Link>
                    <button onClick={loadOrders} className="text-sm text-gray-500 border rounded px-3 py-1">
                        重新整理
                    </button>
                </div>
            </div>

            {activeOrders.length === 0 && (
                <p className="text-gray-400 text-center py-12">目前沒有進行中的訂單</p>
            )}

            <div className="space-y-4">
                {activeOrders.map(order => (
                    <div key={order.id} className="border rounded-lg p-4 space-y-3">

                        <div className="flex justify-between items-start">
                            <div>
                                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                                    {STATUS_LABEL[order.status]}
                                </span>
                                {order.queue_number && (
                                    <span className="ml-2 text-sm text-gray-500">#{order.queue_number}</span>
                                )}
                            </div>
                            <span className="text-sm text-gray-400">
                                {new Date(order.created_at).toLocaleTimeString('zh-TW')}
                            </span>
                        </div>

                        <div>
                            <p className="font-medium">{order.line_display_name}</p>
                            <div className="text-sm text-gray-500 space-y-0.5 mt-1">
                                {order.order_items.map((item, i) => (
                                    <p key={i}>{item.products.name} × {item.quantity}</p>
                                ))}
                            </div>
                            <p className="font-bold mt-2">NT$ {order.total_amount}</p>
                            {order.payment_method === 'bank_transfer' && order.remit_last5 && (
                                <p className="text-sm text-purple-600">匯款後五碼：{order.remit_last5}</p>
                            )}
                        </div>

                        {/* 操作按鈕 */}
                        <div className="flex gap-2 flex-wrap">
                            {order.status === 'pending' && (<>
                                <button
                                    onClick={() => handleAction(order.id, 'accept')}
                                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                                >接單</button>
                                <button
                                    onClick={() => setActionState({ orderId: order.id, action: 'reject', reason: '' })}
                                    className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm"
                                >拒絕</button>
                            </>)}

                            {order.status === 'in_production' && (<>
                                <button
                                    onClick={() => handleAction(order.id, 'ready')}
                                    className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                                >製作完成</button>
                                <button
                                    onClick={() => setActionState({ orderId: order.id, action: 'cancel', reason: '' })}
                                    className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm"
                                >取消</button>
                            </>)}

                            {order.status === 'payment_submitted' && (
                                <button
                                    onClick={() => handleAction(order.id, 'confirm-payment')}
                                    className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                                >確認付款</button>
                            )}
                        </div>

                        {/* 原因輸入框（inline 展開） */}
                        {actionState?.orderId === order.id && (
                            <div className="flex gap-2 items-center mt-2">
                                <input
                                    type="text"
                                    value={actionState.reason}
                                    onChange={e => setActionState({ ...actionState, reason: e.target.value })}
                                    placeholder={actionState.action === 'reject' ? '拒絕原因' : '取消原因'}
                                    className="flex-1 border rounded px-2 py-1 text-sm"
                                />
                                <button
                                    onClick={() => {
                                        if (!actionState.reason.trim()) return
                                        handleAction(actionState.orderId, actionState.action, { reason: actionState.reason })
                                        setActionState(null)
                                    }}
                                    className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                                >確認</button>
                                <button
                                    onClick={() => setActionState(null)}
                                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                                >取消</button>
                            </div>
                        )}

                    </div>
                ))}
            </div>
        </div>
    )
}
