import { NextRequest } from 'next/server'
import { assertPermission, verifyAdmin } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const ACTIVE_STATUSES = ['pending', 'in_production', 'pending_payment', 'payment_submitted']

export async function GET(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        const supabase = getSupabaseAdmin()

        const { searchParams } = new URL(req.url)
        const status    = searchParams.get('status')
        const sessionId = searchParams.get('sessionId')
        const dateFrom  = searchParams.get('dateFrom')
        const dateTo    = searchParams.get('dateTo')
        const history   = searchParams.get('history')

        if (history === 'true') {
            assertPermission(ctx, 'stats:view')
        }

        let query = supabase
            .from('orders')
            .select(`
                id, status, line_display_name, total_amount,
                queue_number, payment_method, remit_last5, created_at,
                session_id,
                order_items (
                    quantity, unit_price,
                    products ( name )
                )
            `)
            .order('created_at', { ascending: false })

        if (status) {
            query.eq('status', status)
        } else if (history !== 'true'){
            query = query.in('status', ACTIVE_STATUSES)
        }

        if (sessionId) query = query.eq('session_id', sessionId)
        if (dateFrom)  query = query.gte('created_at', dateFrom)
        if (dateTo)    query = query.lte('created_at', dateTo)

        const { data: orders, error } = await query

        if (error) throw new Error(error.message)

        return Response.json({ data: orders })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}