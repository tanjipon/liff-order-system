import { NextRequest } from 'next/server'
import { verifyLiffToken } from '@/lib/auth/verifyLiff'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()
        const { note } = await req.json()

        // verify ownership
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('line_user_id, status')
            .eq('id', id)
            .single()

        if (fetchError || !order) return errorResponse('ORDER_NOT_FOUND', 404)
        if (order.line_user_id !== profile.userId) return errorResponse('FORBIDDEN', 403)
        if (order.status === 'cancelled') return errorResponse('ORDER_CANCELLED', 400)

        const { error } = await supabase
            .from('orders')
            .update({ customer_note: note ?? null })
            .eq('id', id)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
