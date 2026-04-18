import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRODUCT_ID = 'bbbbbbbb-0000-0000-0000-000000000001'

test.beforeEach(async () => {
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('products').update({ stock_qty: 20 }).eq('id', PRODUCT_ID)
})

test('Order flow happy path', async ({ page }) => {
    // 1. open order page
    await page.goto('/liff/order')

    // 2. check products list is listed
    await expect(page.getByText('草莓塔')).toBeVisible()
    await expect(page.getByText('4月甜點開單')).toBeVisible()

    // 3. click '草莓塔' twice
    const STRAWBERRY_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
    const strawberryRow = page.getByTestId(`product-${STRAWBERRY_ID}`)
    await strawberryRow.getByRole('button', { name: '+' }).click()
    await strawberryRow.getByRole('button', { name: '+' }).click()

    // 4. comfirm amount is correct (150 x 2 = 300)
    await expect(page.getByText('小計：NT$ 300')).toBeVisible()

    // 5. check quota hint is updated
    await expect(page.getByText('已選 2 件')).toBeVisible()

    // 6. send the order
    await page.getByRole('button', { name: /送出訂單/ }).click()

    // 7. check sucess display
    await expect(page.getByText('訂單已送出')).toBeVisible()
    await expect(page.getByText('訂單編號')).toBeVisible()
})