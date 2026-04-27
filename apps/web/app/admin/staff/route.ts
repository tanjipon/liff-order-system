import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET (req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'staff:manage')
    
        const supabase = getSupabaseAdmin()

        // 1. check user_roles
        const { data: userRoles, error } = await supabase
            .from('user_roles')
            .select(`
                user_id,
                display_name,
                is_active,
                created_at,
                roles ( id, name )    
            `)
            .order('created_at', { ascending: true })

        if (error) throw new Error(error.message)

        // 2. checl auth.users to get email
        const userIds = (userRoles ?? []).map(r => r.user_id)
        const { data: { users }, error: authError } = 
            await supabase.auth.admin.listUsers()

        if (authError) throw new Error(authError.message)

        const emailMap = Object.fromEntries(
            userIds.map(u => [u.id, u.email ?? ''])
        )

        // 3. merge
        const staff = (userRoles ?? []).map(r => ({
            userId:         r.user_id,
            displayName:    r.display_name,
            isActive:       r.is_active,
            email:          emailMap[r.user_id] ?? '',
            role:           r.roles,
        }))

        return Response.json({ data: staff })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}