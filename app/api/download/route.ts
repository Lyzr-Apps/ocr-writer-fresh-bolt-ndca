import { NextRequest, NextResponse } from 'next/server'

/**
 * POST & GET /api/download
 *
 * Server-side file download endpoint.
 * POST: Accepts { content, filename } JSON body, returns downloadable .wrt file.
 * GET: Returns a simple status response (handles proxy redirects).
 *
 * Files are formatted for Notepad++ compatibility:
 * - UTF-8 encoding with BOM
 * - Windows-style CRLF line endings
 */

function buildDownloadResponse(content: string, filename: string) {
  const safeFilename = (filename || 'extracted_text').replace(/[^a-zA-Z0-9_\-\.]/g, '_')

  // Normalize line endings to Windows CRLF for Notepad++ compatibility
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n')

  // Prepend UTF-8 BOM so Notepad++ detects encoding automatically
  const BOM = '\uFEFF'
  const fileContent = BOM + normalizedContent

  // Encode as UTF-8 bytes
  const encoder = new TextEncoder()
  const bytes = encoder.encode(fileContent)

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename}.wrt"`,
      'Cache-Control': 'no-cache',
      'Content-Length': bytes.length.toString(),
    },
  })
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Use POST with { content, filename } to download a .wrt file' })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, filename } = body

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    return buildDownloadResponse(content, filename)
  } catch {
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    )
  }
}
