import { NextRequest } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        await verifyAdmin(req)
        const supabase = getSupabaseAdmin()

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
        id, status, line_display_name, total_amount,
        queue_number, payment_method, remit_last5, created_at,
        order_items (
          quantity, unit_price,
          products ( name )
        )
      `)
            .in('status', ['pending', 'in_production', 'pending_payment', 'payment_submitted'])
            .order('created_at', { ascending: true })

        if (error) throw new Error(error.message)

        return Response.json({ data: orders })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}