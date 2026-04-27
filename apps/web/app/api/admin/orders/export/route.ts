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
                id, status, line_display_name, total_amount,
                queue_number, payment_method, remit_last5, created_at,
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

        const csv = buildCsv(orders ?? [])

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

type OrderRow = {
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
        products: { name: string }[]
    }[]
}

function buildCsv(orders: OrderRow[]): string {
    const headers = ['訂單編號', '狀態', '顧客名稱', '付款方式', '匯款後五碼', '總金額', '排單號', '商品明細', '建立時間']

    const rows = orders.map(o => [
        o.id,
        o.status,
        o.line_display_name,
        o.payment_method,
        o.remit_last5 ?? '',
        o.total_amount,
        o.queue_number ?? '',
        o.order_items.map(i => `${i.products[0]?.name ?? ''}x${i.quantity}`).join('|'),
        new Date(o.created_at).toLocaleString('zh-TW'),
    ])

    const escape = (v: unknown) => {
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s
    }

    return [headers, ...rows]
        .map(row => row.map(escape).join(','))
        .join('\n')
}
