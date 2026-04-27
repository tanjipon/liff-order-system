import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'pickup_options:manage')

        const supabase = getSupabaseAdmin()

        // check current status
        const { data: current, error: fetchError } = await supabase
            .from('pickup_options')
            .select('is_active')
            .eq('id', id)
            .single()

        if (fetchError || !current) return errorResponse('NOT_FOUND', 404)

        // reverse
        const { error } = await supabase
            .from('pickup_options')
            .update({ is_active: !current.is_active })
            .eq('id', id)

        if (error) throw new Error(error.message)

        return Response.json({ data: { isActive: !current.is_active } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
