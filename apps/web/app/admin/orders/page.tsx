'use client'

import { useState } from 'react'
import { adminFetch } from '@/lib/auth/adminClient'

type Order = {
    id: string
    status: string
    line_display_name: string
    total_amount: number
    queue_number: number | null
    payment_method: string
    created_at: string
    order_items: {
        quantity: number
        unit_price: number
        products: { name: string }[]
    }[]
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

export default function OrderHistoryPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    const [status, setStatus] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    async function handleSearch() {
        setLoading(true)
        const params = new URLSearchParams({ history: 'true' })
        if (status) params.set('status', status)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)

        const res = await adminFetch(`/api/admin/orders?${params}`)
        const body = await res.json()
        setOrders(body.data ?? [])
        setLoading(false)
        setSearched(true)
    }

    async function handleExport() {
        const params = new URLSearchParams()
        if (status) params.set('status', status)
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
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">歷史訂單查詢</h1>

            {/* filter */}
            <div className="flex gap-3 flex-wrap mb-6">
                <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="border rounded px-3 py-2 text-sm"
                >
                    <option value="">所有狀態</option>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>

                <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="border rounded px-3 py-2 text-sm"
                    placeholder="開始日期"
                />
                <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="border rounded px-3 py-2 text-sm"
                    placeholder="結束日期"
                />

                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                >
                    {loading ? '查詢中...' : '查詢'}
                </button>
                <button
                    onClick={handleExport}
                    disabled={!searched || loading}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm disabled:opacity-50"
                >
                    匯出 CSV
                </button>
            </div>

            {/* results */}
            {!searched && (
                <p className="text-gray-400 text-center py-12">設定篩選條件後按查詢</p>
            )}

            {searched && orders.length === 0 && (
                <p className="text-gray-400 text-center py-12">查無符合的訂單</p>
            )}

            <div className="space-y-3">
                {orders.map(order => (
                    <div key={order.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                                    {STATUS_LABEL[order.status]}
                                </span>
                                {order.queue_number && (
                                    <span className="text-sm text-gray-500">#{order.queue_number}</span>
                                )}
                            </div>
                            <span className="text-sm text-gray-400">
                                {new Date(order.created_at).toLocaleString('zh-TW')}
                            </span>
                        </div>

                        <p className="font-medium">{order.line_display_name}</p>
                        <div className="text-sm text-gray-500 space-y-0.5">
                            {order.order_items.map((item, i) => (
                                <p key={i}>{item.products[0]?.name} × {item.quantity}</p>
                            ))}
                        </div>
                        <p className="font-bold">NT$ {order.total_amount}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}
