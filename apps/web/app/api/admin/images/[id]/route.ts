import { NextRequest } from 'next/server'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')

        const supabase = getSupabaseAdmin()
        const { name } = await req.json()

        const { error } = await supabase
            .from('product_images')
            .update({ name })
            .eq('id', id)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')

        const supabase = getSupabaseAdmin()

        // 取得圖片 URL 以便刪除 R2 物件
        const { data: img, error: fetchErr } = await supabase
            .from('product_images')
            .select('url')
            .eq('id', id)
            .single()

        if (fetchErr || !img) return errorResponse('IMAGE_NOT_FOUND', 404)

        // 刪除 R2 物件
        const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!
        const key = img.url.startsWith(publicBase)
            ? img.url.slice(publicBase.length + 1)
            : null

        if (key) {
            await s3.send(new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: key,
            }))
        }

        // 刪除 DB 記錄
        const { error } = await supabase
            .from('product_images')
            .delete()
            .eq('id', id)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
