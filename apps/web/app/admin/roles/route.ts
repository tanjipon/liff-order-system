import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'roles:manage')

        const supabase = getSupabaseAdmin()

        const { data: roles, error } = await supabase
            .from('roles')
            .select(`
                id,
                name,
                created_at,
                role_permissions (
                    permissions ( id, key, name )
                )
            `)
            .order('created_at', { ascending: true })

        if (error) throw new Error(error.message)

        return Response.json({ data: roles })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'roles:manage')

        const supabase = getSupabaseAdmin()
        const { name } = await req.json()

        if (!name) return errorResponse('MISSING_FIELDS', 400)

        const { data, error } = await supabase
            .from('roles')
            .insert({ name })
            .select('id')
            .single()

        if (error) {
            if (error.code === '23505') return errorResponse('ROLE_ALREADY_EXISTS', 400)
            throw new Error(error.message)
        }

        return Response.json({ data: { roleId: data.id } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
