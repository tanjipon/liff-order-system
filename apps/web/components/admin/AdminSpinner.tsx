export default function AdminSpinner({ fullPage = true }: { fullPage?: boolean }) {
    const content = (
        <div className="flex items-center gap-2" style={{ color: 'var(--color-admin-muted)' }}>
            <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                />
            </svg>
            <span className="text-sm">載入中</span>
        </div>
    )

    if (!fullPage) return content

    return (
        <div className="min-h-screen flex items-center justify-center"
             style={{ backgroundColor: 'var(--color-admin-bg)' }}>
            {content}
        </div>
    )
}
