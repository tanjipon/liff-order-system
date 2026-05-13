import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: productId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')

        const supabase = getSupabaseAdmin()
        const { imageId } = await req.json()
        if (!imageId) return errorResponse('missing imageId', 400)

        // next position = current max + 1
        const { data: existing } = await supabase
            .from('product_image_links')
            .select('position')
            .eq('product_id', productId)
            .order('position', { ascending: false })
            .limit(1)

        const nextPosition = existing?.[0]?.position != null
            ? existing[0].position + 1
            : 0

        const { data, error } = await supabase
            .from('product_image_links')
            .insert({ product_id: productId, image_id: imageId, position: nextPosition })
            .select('id, position, product_images(id, url)')
            .single()

        if (error) throw new Error(error.message)

        return Response.json({ data })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
