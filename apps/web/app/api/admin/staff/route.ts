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

        // 2. check auth.users to get email
        const { data: { users }, error: authError } = 
            await supabase.auth.admin.listUsers()

        if (authError) throw new Error(authError.message)

        const emailMap = Object.fromEntries(
            users.map(u => [u.id, u.email ?? ''])
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

export async function POST (req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'staff:manage')

        const supabase = getSupabaseAdmin()
        const { displayName, email, roleId } = await req.json()

        if (!displayName || !email || !roleId) {
            return errorResponse('MISSING_FIELD', 400)
        }

        // 1. send invite email and create auth user
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        const { data: inviteData, error: inviteError } =
            await supabase.auth.admin.inviteUserByEmail(email, {
                redirectTo: `${appUrl}/auth/callback`,
            })

        if (inviteError) return errorResponse('CREATE_USER_FAILED', 400)

        // 2. create user_roles record
        const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
                user_id:        inviteData.user.id,
                role_id:        roleId,
                display_name:   displayName,
                is_active:      true
            })

        if (roleError) throw new Error(roleError.message)

        return Response.json({ data: { userId: inviteData.user.id } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}