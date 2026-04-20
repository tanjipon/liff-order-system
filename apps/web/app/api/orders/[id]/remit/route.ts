import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLiffToken } from '@/lib/auth/verifyLiff'
import { assertTransition } from '@/lib/orderStatus'
import { errorResponse } from '@/lib/api/response'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const profile = await verifyLiffToken(req)
        const { remitLast5 } = await req.json()

        // 1. get orders and validate the owner
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('status, line_user_id')
            .eq('id', params.id)
            .single()

        if (fetchError || !order) return errorResponse('ORDER_NOT_FOUND', 404)
        if (order.line_user_id !== profile.userId) return errorResponse('FORBIDDDEN', 403)

        // 2. state check
        assertTransition(order.status, 'payment_submitted')

        // 3. update remit_last5 and status
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                remitLast5: remitLast5,
                status: 'payment_submitted',
            })
            .eq('id', params.id)

        if (updateError) throw new Error(updateError?.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}