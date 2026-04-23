import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { assertTransition } from '@/lib/orderStatus'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const cxt = await verifyAdmin(req)
        assertPermission(cxt, 'orders:accept')
        const supabase = getSupabaseAdmin()

        // 1. get order
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('status, session_id')
            .eq('id', id)
            .single()

        if (fetchError || !order) return errorResponse('ORDER_NOT_FOUND', 404)

        // 2. status validation
        assertTransition(order.status, 'in_production')

        // 3. calculate order number
        const { data: maxRow } = await supabase
            .from('orders')
            .select('queue_number')
            .eq('session_id', order.session_id)
            .not('queue_number', 'is', null)
            .order('queue_number', { ascending: false })
            .limit(1)
            .single()

        const queueNumber = (maxRow?.queue_number ?? 0) + 1

        // 4. update status
        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: 'in_production', queue_number: queueNumber })
            .eq('id', id)

        if (updateError) throw new Error(updateError.message)

        return Response.json({ data: { queueNumber } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}