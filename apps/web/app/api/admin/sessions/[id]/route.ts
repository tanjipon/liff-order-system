import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await verifyAdmin(req)
        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase
            .from('sessions')
            .select(`
                id, title, opens_at, closes_at, per_person_limit, is_active, created_at,
                products ( id, name, price, stock_qty, max_per_person )
            `)
            .eq('id', id)
            .single()

        if (error || !data) return errorResponse('SESSION_NOT_FOUND', 404)

        return Response.json({ data })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')

        const supabase = getSupabaseAdmin()
        const { title, opensAt, closesAt, perPersonLimit } = await req.json()

        const { error } = await supabase
            .from('sessions')
            .update({
                title,
                opens_at: opensAt ?? null,
                closes_at: closesAt ?? null,
                per_person_limit: perPersonLimit ?? null,
            })
            .eq('id', id)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

