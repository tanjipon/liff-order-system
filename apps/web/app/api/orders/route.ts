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