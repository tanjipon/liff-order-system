import { vi } from 'vitest'

vi.mock('@/lib/auth/verifyAdmin', () => ({
    verifyAdmin: vi.fn().mockResolvedValue({
        userId:      'admin-test-user',
        displayName: 'test admin',
        roleId:      '00000000-0000-0000-0000-000000000001',
        roleName:    'owner',
        permissions: ['pickup_options:manage'],
    }),
    assertPermission: vi.fn(),
}))

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { GET as getPickupOptions, POST as createPickupOption } from '@/app/api/admin/pickup-options/route'
import { PATCH as updatePickupOption } from '@/app/api/admin/pickup-options/[id]/route'
import { PATCH as togglePickupOption } from '@/app/api/admin/pickup-options/[id]/toggle/route'
import { PATCH as reorderPickupOptions } from '@/app/api/admin/pickup-options/reorder/route'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function adminReq(url: string, method = 'GET', body?: object) {
    return new NextRequest(url, {
        method,
        headers: {
            Authorization: 'Bearer mock',
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    })
}

let pickupOptionId: string

describe('POST /admin/pickup-options', () => {
    it('add pickup option', async () => {
        const req = adminReq('http://localhost/api/admin/pickup-options', 'POST', {
            name:        '自取',
            description: '到店自取',
            extraFee:    0,
        })
        const res = await createPickupOption(req)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.pickupOptionId).toBeDefined()
        pickupOptionId = body.data.pickupOptionId
    })

    it('add pickup option with specific payment method', async () => {
        const req = adminReq('http://localhost/api/admin/pickup-options', 'POST', {
            name:                   '宅配',
            extraFee:               100,
            allowedPaymentMethods:  ['bank_transfer'],
        })
        const res = await createPickupOption(req)
        const body = await res.json()

        expect(res.status).toBe(201)

        const { data } = await supabase
            .from('pickup_options')
            .select('allowed_payment_methods')
            .eq('id', body.data.pickupOptionId)
            .single()

        expect(data?.allowed_payment_methods).toEqual(['bank_transfer'])
    })
})

describe('GET /admin/pickup-options', () => {
    it('list all pickup options including deactive ones', async () => {
        const req = adminReq('http://localhost/api/admin/pickup-options')
        const res = await getPickupOptions(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(Array.isArray(body.data)).toBe(true)
        expect(body.data.some((o: any) => o.id === pickupOptionId)).toBe(true)
    })
})

describe('PATCH /admin/pickup-options/:id', () => {
    it('change pickup option name and fee', async () => {
        const req = adminReq(
            `http://localhost/api/admin/pickup-options/${pickupOptionId}`,
            'PATCH',
            { name: '門市自取', extraFee: 0 }
        )
        const res = await updatePickupOption(req, { params: Promise.resolve({ id: pickupOptionId }) })
        expect(res.status).toBe(200)

        const { data } = await supabase
            .from('pickup_options')
            .select('name')
            .eq('id', pickupOptionId)
            .single()

        expect(data?.name).toBe('門市自取')
    })
})

describe('PATCH /admin/pickup-options/:id/toggle', () => {
    it('toggle activeness', async () => {
        const { data: before } = await supabase
            .from('pickup_options')
            .select('is_active')
            .eq('id', pickupOptionId)
            .single()

        const req = adminReq(
            `http://localhost/api/admin/pickup-options/${pickupOptionId}/toggle`,
            'PATCH'
        )
        const res = await togglePickupOption(req, { params: Promise.resolve({ id: pickupOptionId }) })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.isActive).toBe(!before?.is_active)
    })
})

describe('PATCH /admin/pickup-options/reorder', () => {
    it('update order', async () => {
        const req = adminReq(
            'http://localhost/api/admin/pickup-options/reorder',
            'PATCH',
            { order: [{ id: pickupOptionId, sortOrder: 99 }] }
        )
        const res = await reorderPickupOptions(req)
        expect(res.status).toBe(200)

        const { data } = await supabase
            .from('pickup_options')
            .select('sort_order')
            .eq('id', pickupOptionId)
            .single()

        expect(data?.sort_order).toBe(99)
    })
})
