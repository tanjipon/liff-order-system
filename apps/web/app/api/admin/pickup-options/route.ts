import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'pickup_options:manage')

        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase
            .from('pickup_options')
            .select('id, name, description, extra_fee, allowed_payment_methods, is_active, sort_order')
            .order('sort_order', { ascending: true })

        if (error) throw new Error(error.message)

        return Response.json({ data })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
