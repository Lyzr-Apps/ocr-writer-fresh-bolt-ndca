import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/download
 *
 * Server-side file download endpoint.
 * Accepts text content and filename, returns as a downloadable file.
 * This is a fallback for environments where client-side Blob downloads are blocked.
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

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFilename}.wrt"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    )
  }
}
