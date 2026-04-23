import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        await verifyAdmin(req)
        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase
            .from('sessions')
            .select('id, title, opens_at, closes_at, per_person_limit, is_active, created_at')
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
        assertPermission(ctx, 'sessions:create')

        const supabase = getSupabaseAdmin()
        const { title, opensAt, closesAt, perPersonLimit } = await req.json()

        const { data, error } = await supabase
            .from('sessions')
            .insert({
                title,
                opens_at: opensAt ?? null,
                closes_at: closesAt ?? null,
                per_person_limit: perPersonLimit ?? null,
                is_active: true,
            })
            .select('id')
            .single()

        if (error) throw new Error(error.message)

        return Response.json({ data: { sessionId: data.id } }, { status: 201 })

    } catch (e: any) {
        return errorResponse(e.message)
    }
}