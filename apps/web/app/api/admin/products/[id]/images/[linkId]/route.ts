import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; linkId: string }> }
) {
    try {
        const { linkId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')

        const supabase = getSupabaseAdmin()
        const { error } = await supabase
            .from('product_image_links')
            .delete()
            .eq('id', linkId)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
