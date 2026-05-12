import { NextRequest } from 'next/server'
import { assertPermission, verifyAdmin } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const ACTIVE_STATUSES = ['pending', 'in_production', 'pending_payment', 'payment_submitted']
const DEFAULT_LIMIT = 20

export async function GET(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        const supabase = getSupabaseAdmin()

        const { searchParams } = new URL(req.url)
        const status    = searchParams.get('status')
        const sessionId = searchParams.get('sessionId')
        const productId = searchParams.get('productId')
        const dateFrom  = searchParams.get('dateFrom')
        const dateTo    = searchParams.get('dateTo')
        const history   = searchParams.get('history')
        const page      = Math.max(1, Number(searchParams.get('page') ?? 1))
        const limit     = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? DEFAULT_LIMIT)))

        if (history === 'true') {
            assertPermission(ctx, 'stats:view')
        }

        // Use !inner join when filtering by product so only matching orders are returned
        const orderItemsSelect = productId
            ? 'order_items!inner ( product_id, quantity, unit_price, products ( name ) )'
            : 'order_items ( product_id, quantity, unit_price, products ( name ) )'

        let query = supabase
            .from('orders')
            .select(`
                id, status, line_display_name, total_amount, pickup_fee,
                queue_number, payment_method, remit_last5, created_at,
                session_id, customer_note, admin_note,
                customer_name, customer_phone,
                recipient_name, recipient_phone, recipient_address,
                pickup_options ( name ),
                ${orderItemsSelect}
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1)

        if (status) {
            query = query.eq('status', status)
        } else if (history !== 'true') {
            query = query.in('status', ACTIVE_STATUSES)
        }

        if (sessionId) query = query.eq('session_id', sessionId)
        if (productId) query = query.eq('order_items.product_id', productId)
        if (dateFrom)  query = query.gte('created_at', dateFrom)
        if (dateTo)    query = query.lte('created_at', dateTo)

        const { data: orders, error, count } = await query

        if (error) throw new Error(error.message)

        return Response.json({
            data: orders,
            total: count ?? 0,
            page,
            limit,
            totalPages: Math.ceil((count ?? 0) / limit),
        })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
