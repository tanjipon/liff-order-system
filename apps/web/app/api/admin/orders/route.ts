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
        const status      = searchParams.get('status')
        const sessionId   = searchParams.get('sessionId')
        const productIds  = (searchParams.get('productIds') ?? '').split(',').filter(Boolean)
        const dateFrom    = searchParams.get('dateFrom')
        const dateTo      = searchParams.get('dateTo')
        const history     = searchParams.get('history')
        const orderNumber = searchParams.get('orderNumber')
        const page        = Math.max(1, Number(searchParams.get('page') ?? 1))
        const limit       = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? DEFAULT_LIMIT)))

        if (history === 'true') {
            assertPermission(ctx, 'stats:view')
        }

        // Step 1: if filtering by product(s), find matching order IDs first
        // This avoids !inner which would also filter out other order_items in the result
        let filteredOrderIds: string[] | null = null
        if (productIds.length > 0) {
            const { data: items } = await supabase
                .from('order_items')
                .select('order_id')
                .in('product_id', productIds)
            if (!items || items.length === 0) {
                return Response.json({ data: [], total: 0, page, limit, totalPages: 0 })
            }
            filteredOrderIds = [...new Set(items.map((i: any) => i.order_id))]
        }

        let query = supabase
            .from('orders')
            .select(`
                id, status, line_display_name, total_amount, pickup_fee,
                order_number, queue_number, payment_method, remit_last5, created_at,
                session_id, customer_note, admin_note,
                customer_name, customer_phone,
                recipient_name, recipient_phone, recipient_address,
                sessions ( title ),
                pickup_options ( name ),
                order_items ( product_id, quantity, unit_price, products ( name ) )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1)

        if (orderNumber) {
            query = query.eq('order_number', Number(orderNumber))
        } else if (status) {
            query = query.eq('status', status)
        } else if (history !== 'true') {
            query = query.in('status', ACTIVE_STATUSES)
        }

        if (sessionId)        query = query.eq('session_id', sessionId)
        if (filteredOrderIds) query = query.in('id', filteredOrderIds)
        if (dateFrom)         query = query.gte('created_at', dateFrom)
        if (dateTo)           query = query.lte('created_at', dateTo)

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
