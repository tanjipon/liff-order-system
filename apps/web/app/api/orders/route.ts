import { NextRequest } from 'next/server'
import { verifyLiffToken } from '@/lib/auth/verifyLiff'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()

        const { sessionId, items, pickupOptionId, paymentMethod } = await req.json()

        const { data: orderId, error } = await supabase.rpc('create_order', {
            p_session_id:           sessionId,
            p_line_user_id:         profile.userId,
            p_display_name:         profile.displayName,
            p_items:                items,
            p_pickup_option_id:     pickupOptionId,
            p_payment_method:       paymentMethod
        })

        if (error) throw new Error(error.message)

        const { data: order } = await supabase
            .from('orders')
            .select('order_number')
            .eq('id', orderId)
            .single()

        return Response.json({ data: { orderId, orderNumber: order?.order_number ?? null } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function GET(req: NextRequest) {
    try {
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                payment_method,
                total_amount,
                pickup_fee,
                remit_last5,
                queue_number,
                created_at,
                customer_note,
                sessions ( title ),
                order_items (
                    quantity,
                    unit_price,
                    product_id,
                    products ( name )
                )
            `)
            .eq('line_user_id', profile.userId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)

        return Response.json({ data: orders })
    } catch (e: any) {
        return errorResponse(e.message)
    }
} 