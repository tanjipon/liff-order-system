import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: targetUserId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'staff:manage')

        const supabase = getSupabaseAdmin()

        // 1. get user email
        const { data: { user }, error: userError } =
            await supabase.auth.admin.getUserById(targetUserId)

        if (userError || !user) return errorResponse('USER_NOT_FOUND', 404)

        // 2. resen email
        const { error: inviteError } =
            await supabase.auth.admin.inviteUserByEmail(user.email!)

        if (inviteError) return errorResponse('RESEND_FAILED', 400)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
