import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/download
 *
 * Server-side file download endpoint.
 * Accepts text content and filename, returns as a downloadable .wrt file.
 * The file is formatted for Notepad++ compatibility:
 * - UTF-8 encoding with BOM (so Notepad++ auto-detects encoding)
 * - Windows-style CRLF line endings (standard for Notepad++)
 */
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
  } catch (error) {
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    )
  }
}
