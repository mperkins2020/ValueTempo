import Link from "next/link"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">AVS Brain by ValueTempo</h1>
        <div className="space-y-4">
          <Link href="/catalogs" className="block text-blue-600 hover:underline">
            View Catalogs →
          </Link>
          <div className="text-sm text-gray-600 mt-8">
            <p>API Endpoints:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  GET /api/runtime/config?workspace_id=ws_1049&segment=ai_video_smb&stage=learning&target_environment=production
                </code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}

