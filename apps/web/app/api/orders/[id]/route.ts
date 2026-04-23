import { NextRequest } from 'next/server'
import { verifyLiffToken } from '@/lib/auth/verifyLiff'
import { errorResponse } from '@/lib/api/response'
import { assertCancellable } from '@/lib/orderStatus'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PUT (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }>  }
) {
    try {
        const { id } = await params
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()
        const { items } = await req.json()

        const { error } = await supabase.rpc('update_order', {
            p_order_id:     id,
            p_line_user_id: profile.userId,
            p_items:        items
        })

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function DELETE (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()

        // 1. get order and validate owner
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('status, line_user_id')
            .eq('id', id)
            .single()

        if (fetchError || !order) return errorResponse('ORDER_NOT_FOUND', 404)
        if (order.line_user_id !== profile.userId) throw errorResponse('FORBIDDEN', 403)

        // 2. status check: only in pending status can be deleted
        if (order.status !== 'pending') return errorResponse('INVALID_TRANSITION', 400)

        // 3. call DB function to release stock and update status
        const { error } = await supabase.rpc('admin_cancel_order', {
            p_order_id: id,
            p_reason: '客戶自行取消'
        })

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}