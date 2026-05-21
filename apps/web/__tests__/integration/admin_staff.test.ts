import { vi } from 'vitest'

vi.mock('@/lib/auth/verifyAdmin', () => ({
    verifyAdmin: vi.fn().mockResolvedValue({
        userId:      'admin-test-user',
        displayName: 'test admin',
        roleId:      '00000000-0000-0000-0000-000000000001',
        roleName:    'owner',
        permissions: ['staff:manage', 'roles:manage'],
    }),
    assertPermission: vi.fn(),
}))

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { GET as getStaff, POST as createStaff } from '@/app/api/admin/staff/route'
import { PATCH as updateStaff } from '@/app/api/admin/staff/[id]/route'
import { PATCH as deactivateStaff } from '@/app/api/admin/staff/[id]/deactive/route'
import { PATCH as activateStaff } from '@/app/api/admin/staff/[id]/active/route'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function adminReq(url: string, body?: object) {
    return new NextRequest(url, {
        method: body ? 'POST' : 'GET',
        headers: {
            Authorization: 'Bearer mock',
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    })
}

let testUserId: string
let assistantRoleId: string

beforeAll(async () => {
    // 取得 assistant role id
    const { data } = await supabase
        .from('roles')
        .select('id')
        .eq('name', '助手')
        .single()
    assistantRoleId = data!.id
})

describe('POST /admin/staff', () => {
    it('add staff: send invite and create user_roles', async () => {
        const email = `test-staff-${Date.now()}@example.com`
        const req = adminReq('http://localhost/api/admin/staff', {
            displayName: 'test_user',
            email,
            roleId: assistantRoleId,
        })

        const res = await createStaff(req)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.userId).toBeDefined()

        testUserId = body.data.userId

        // check user_roles created
        const { data: ur } = await supabase
            .from('user_roles')
            .select('role_id, is_active')
            .eq('user_id', testUserId)
            .single()

        expect(ur?.role_id).toBe(assistantRoleId)
        expect(ur?.is_active).toBe(true)
    })
})

describe('GET /admin/staff', () => {
    it('list all users including newly created user', async () => {
        const req = new NextRequest('http://localhost/api/admin/staff', {
            headers: { Authorization: 'Bearer mock' },
        })

        const res = await getStaff(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        const found = body.data.find((s: any) => s.userId === testUserId)
        expect(found).toBeDefined()
        expect(found.displayName).toBe('test_user')
    })
})

describe('PATCH /admin/staff/:id', () => {
    it('change name', async () => {
        const req = new NextRequest(`http://localhost/api/admin/staff/${testUserId}`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer mock', 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: 'changed_name' }),
        })

        const res = await updateStaff(req, { params: Promise.resolve({ id: testUserId }) })
        expect(res.status).toBe(200)

        const { data: ur } = await supabase
            .from('user_roles')
            .select('display_name')
            .eq('user_id', testUserId)
            .single()

        expect(ur?.display_name).toBe('changed_name')
    })
})

describe('PATCH /admin/staff/:id/deactivate', () => {
    it('deactive user', async () => {
        const req = new NextRequest(`http://localhost/api/admin/staff/${testUserId}/deactivate`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer mock' },
        })

        const res = await deactivateStaff(req, { params: Promise.resolve({ id: testUserId }) })
        expect(res.status).toBe(200)

        const { data: ur } = await supabase
            .from('user_roles')
            .select('is_active')
            .eq('user_id', testUserId)
            .single()

        expect(ur?.is_active).toBe(false)
    })

    it('deactive self: return CANNOT_DEACTIVATE_SELF', async () => {
        const req = new NextRequest(`http://localhost/api/admin/staff/admin-test-user/deactivate`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer mock' },
        })

        const res = await deactivateStaff(req, { params: Promise.resolve({ id: 'admin-test-user' }) })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toBe('CANNOT_DEACTIVATE_SELF')
    })
})

describe('PATCH /admin/staff/:id/activate', () => {
    it('reactive user', async () => {
        const req = new NextRequest(`http://localhost/api/admin/staff/${testUserId}/activate`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer mock' },
        })

        const res = await activateStaff(req, { params: Promise.resolve({ id: testUserId }) })
        expect(res.status).toBe(200)

        const { data: ur } = await supabase
            .from('user_roles')
            .select('is_active')
            .eq('user_id', testUserId)
            .single()

        expect(ur?.is_active).toBe(true)
    })
})
