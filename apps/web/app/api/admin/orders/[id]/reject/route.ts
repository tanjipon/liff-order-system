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
        const { reason } = await req.json()
        assertPermission(cxt, 'orders:reject')
        const supabase = getSupabaseAdmin()

        // 1. get order
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('status, session_id')
            .eq('id', id)
            .single()

        if (fetchError || !order) return errorResponse('ORDER_NOT_FOUND', 404)

        // 2. status validation
        assertTransition(order.status, 'cancelled')

        // 3. cancel order
        const { error: updateError } = await supabase.rpc('admin_cancel_order', {
            p_order_id: id,
            p_reason: reason,
        })

        if (updateError) throw new Error(updateError.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}