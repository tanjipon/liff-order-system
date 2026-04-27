import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: userId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'staff:manage')

        const supabase = getSupabaseAdmin()
        const { displayName, roleId } = await req.json()

        const updates: Record<string, unknown> = {}
        if (displayName) updates.display_name = displayName
        if (roleId)      updates.role_id = roleId

        if (Object.keys(updates).length === 0) {
            return errorResponse('MISSING_FIELDS', 400)
        }

        const { error } = await supabase
            .from('user_roles')
            .update(updates)
            .eq('user_id', userId)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
