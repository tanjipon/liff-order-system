import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLiffToken } from '@/lib/auth/verifyLiff'
import { errorResponse } from '@/lib/api/response'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const profile = await verifyLiffToken(req)

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

        return Response.json({ data: { orderId } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function GET(req: NextRequest) {
    try {
        const profile = await verifyLiffToken(req)

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                status,
                payment_method,
                total_amount,
                pickup_fee,
                remit_last5,
                queue_number,
                created_at,
                order_items (
                    quantity,
                    unit_price,
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