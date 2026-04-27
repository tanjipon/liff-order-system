import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: targetUserId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'staff:manage')

        // avoid deactive self
        if (ctx.userId === targetUserId) {
            return errorResponse('CANNOT_DEACTIVATE_SELF', 400)
        }

        const supabase = getSupabaseAdmin()

        const { error } = await supabase
            .from('user_roles')
            .update({ is_active: false })
            .eq('user_id', targetUserId)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
