import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'pickup_options:manage')

        const supabase = getSupabaseAdmin()
        const { order } = await req.json()  // [{ id: '...', sortOrder: 0 }, ...]

        if (!Array.isArray(order) || order.length === 0) {
            return errorResponse('MISSING_FIELDS', 400)
        }

        // batch update
        await Promise.all(
            order.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
                supabase
                    .from('pickup_options')
                    .update({ sort_order: sortOrder })
                    .eq('id', id)
            )
        )

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
