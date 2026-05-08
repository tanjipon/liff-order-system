import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        await verifyAdmin(req)
        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase
            .from('product_images')
            .select('id, url, name, created_at')
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)

        return Response.json({ data })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')

        const supabase = getSupabaseAdmin()
        const { url, name } = await req.json()
        if (!url) return errorResponse('missing url', 400)

        const { data, error } = await supabase
            .from('product_images')
            .insert({ url, name: name ?? null })
            .select('id, url, name, created_at')
            .single()

        if (error) throw new Error(error.message)

        return Response.json({ data })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
