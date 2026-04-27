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
