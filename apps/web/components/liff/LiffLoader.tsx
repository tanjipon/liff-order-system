export default function LiffLoader() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4"
             style={{ backgroundColor: 'var(--color-liff-bg)' }}>
            <img
                src="/loading-dog.gif"
                alt="載入中"
                width={80}
                height={80}
                style={{ imageRendering: 'auto' }}
            />
            <p style={{ color: 'var(--color-liff-muted)' }} className="text-sm">
                載入中...
            </p>
        </div>
    )
}
