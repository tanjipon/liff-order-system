'use client'

import { useEffect, useState } from 'react'

type OrderItem = {
    quantity: number
    unit_price: number,
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
    pending:            '待確認',
    in_production:      '製作中',
    pending_payment:    '待付款',
    payment_submitted:  '付款確認中',
    completed:          '已完成',
    cancelled:          '已取消',
}

const STATUS_COLOR: Record<string, string> = {
    pending:           'bg-yellow-100 text-yellow-700',
    in_production:     'bg-blue-100 text-blue-700',
    pending_payment:   'bg-orange-100 text-orange-700',
    payment_submitted: 'bg-purple-100 text-purple-700',
    completed:         'bg-green-100 text-green-700',
    cancelled:         'bg-gray-100 text-gray-500',
}

export default function StatusPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
    })

    if (loading) return <div className="p-4">載入中...</div>
    if (error)   return <div className="p-4 text-red-500">{error}</div>
    if (orders.length === 0) return <div className="p-4 text-gray-500">目前沒有訂單紀錄</div>

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
                    <div className="space-y-1">
                        {order.order_items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span>{item.products.name} × {item.quantity}</span>
                                <span>NT$ {item.unit_price * item.quantity}</span>
                            </div>
                        ))}
                    </div>

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
                            <p className="text-xs text-orange-500">製作完成！請完成付款</p>
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