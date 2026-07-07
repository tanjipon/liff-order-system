import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'stats:view')

        const supabase = getSupabaseAdmin()
        const { searchParams } = new URL(req.url)
        const sessionId = searchParams.get('sessionId')
        const dateFrom  = searchParams.get('dateFrom')
        const dateTo    = searchParams.get('dateTo')
        const status    = searchParams.get('status')

        let query = supabase
            .from('orders')
            .select(`
                id, status, line_display_name, total_amount, pickup_fee,
                order_number, queue_number, payment_method, remit_last5, created_at,
                customer_name, customer_phone,
                sessions ( title ),
                pickup_options ( name ),
                order_items (
                    quantity, unit_price,
                    products ( name )
                )
            `)
            .order('created_at', { ascending: false })

        if (status)    query = query.eq('status', status)
        if (sessionId) query = query.eq('session_id', sessionId)
        if (dateFrom)  query = query.gte('created_at', dateFrom)
        if (dateTo)    query = query.lte('created_at', dateTo)

        const { data: orders, error } = await query
        if (error) throw new Error(error.message)

        const csv = buildCsv((orders ?? []) as unknown as OrderRow[])

        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="orders.csv"`,
            },
        })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

const STATUS_LABEL: Record<string, string> = {
    pending:           '待確認',
    in_production:     '製作中',
    pending_payment:   '待付款',
    payment_submitted: '付款確認中',
    completed:         '已完成',
    cancelled:         '已取消',
}

type OrderRow = {
    id: string
    status: string
    line_display_name: string
    total_amount: number
    pickup_fee: number
    order_number: number | null
    queue_number: number | null
    payment_method: string
    remit_last5: string | null
    created_at: string
    customer_name: string
    customer_phone: string
    sessions: { title: string } | null
    pickup_options: { name: string } | null   // many-to-one: single object
    order_items: {
        quantity: number
        unit_price: number
        products: { name: string } | null     // many-to-one: single object
    }[]
}

function buildCsv(orders: OrderRow[]): string {
    const headers = [
        '訂單號碼', '排單號', '狀態', 'LINE名稱', '訂購人', '電話',
        '開單名稱', '取貨方式', '付款方式', '匯款後五碼',
        '商品名稱', '數量', '單價', '小計', '總金額', '建立時間',
    ]

    const escape = (v: unknown) => {
        const s = String(v ?? '')
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s
    }

    const itemRows: unknown[][] = []

    for (const o of orders) {
        const orderNum = o.order_number ? `#${String(o.order_number).padStart(4, '0')}` : ''
        const queueNum = o.queue_number ?? ''
        const status   = STATUS_LABEL[o.status] ?? o.status
        const pickup   = o.pickup_options?.name ?? ''
        const payment  = o.payment_method === 'bank_transfer' ? '銀行匯款' : '現金付款'
        const created  = new Date(o.created_at).toLocaleString('zh-TW')

        for (const item of o.order_items) {
            const productName = item.products?.name ?? ''
            const subtotal = item.unit_price * item.quantity

            const phone = o.customer_phone ? `="${o.customer_phone}"` : ''
            itemRows.push([
                orderNum, queueNum, status, o.line_display_name, o.customer_name, phone,
                o.sessions?.title ?? '', pickup, payment, o.remit_last5 ?? '',
                productName, item.quantity, item.unit_price, subtotal, o.total_amount, created,
            ])
        }
    }

    return '\uFEFF' + [headers, ...itemRows]
        .map(row => row.map(escape).join(','))
        .join('\n')
}
