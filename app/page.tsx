'use client'

import React, { useState, useRef, useCallback } from 'react'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { FiFileText, FiUpload, FiImage, FiCheck, FiCheckCircle, FiAlertCircle, FiLoader, FiDownload, FiX, FiCopy, FiInfo, FiCamera, FiMonitor } from 'react-icons/fi'

// --- Constants ---
const AGENT_ID = '69a141d1f77666f08532da44'
const AGENT_NAME = 'OCR Processing Agent'

// --- Monokai Theme ---
const THEME_VARS = {
  '--background': '70 10% 12%',
  '--foreground': '60 30% 96%',
  '--card': '70 10% 16%',
  '--card-foreground': '60 30% 96%',
  '--primary': '52 100% 62%',
  '--primary-foreground': '70 10% 10%',
  '--secondary': '70 10% 22%',
  '--secondary-foreground': '60 30% 96%',
  '--accent': '80 80% 50%',
  '--accent-foreground': '70 10% 8%',
  '--destructive': '338 95% 55%',
  '--muted': '70 10% 26%',
  '--muted-foreground': '50 6% 58%',
  '--border': '70 8% 22%',
  '--input': '70 8% 28%',
  '--ring': '80 76% 53%',
  '--radius': '0rem',
} as React.CSSProperties

// --- Interfaces ---
interface OCRResult {
  extracted_text?: string
  status?: string
  message?: string
  filename?: string
  word_count?: number
}

// --- Sample Data ---
const SAMPLE_RESULT: OCRResult = {
  extracted_text: `INVOICE #2024-0847

From: Acme Corporation
      123 Business Avenue
      San Francisco, CA 94102

To:   Widget Industries
      456 Commerce Street
      New York, NY 10001

Date: February 15, 2024
Due:  March 15, 2024

Description                    Qty    Unit Price    Total
-------------------------------------------------------
Widget Assembly Kit             10     $45.00      $450.00
Premium Connector Pack           5     $28.50      $142.50
Industrial Mounting Bracket      3     $67.00      $201.00
Calibration Service              1    $150.00      $150.00

                              Subtotal:            $943.50
                              Tax (8.5%):           $80.20
                              TOTAL:             $1,023.70

Payment Terms: Net 30
Thank you for your business.`,
  status: 'success',
  message: 'Text extraction completed successfully. Output saved as invoice_2024_0847.wrt',
  filename: 'invoice_2024_0847',
  word_count: 87,
}

// --- ErrorBoundary ---
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- Status Component ---
type StatusType = 'idle' | 'loaded' | 'processing' | 'success' | 'error'

function StatusBar({ status, message }: { status: StatusType; message: string }) {
  const config: Record<StatusType, { icon: React.ReactNode; bgClass: string; textClass: string; borderClass: string }> = {
    idle: {
      icon: <FiInfo className="w-4 h-4 flex-shrink-0" />,
      bgClass: 'bg-secondary',
      textClass: 'text-muted-foreground',
      borderClass: 'border-border',
    },
    loaded: {
      icon: <FiImage className="w-4 h-4 flex-shrink-0" />,
      bgClass: 'bg-secondary',
      textClass: 'text-secondary-foreground',
      borderClass: 'border-border',
    },
    processing: {
      icon: <FiLoader className="w-4 h-4 flex-shrink-0 animate-spin" />,
      bgClass: 'bg-secondary',
      textClass: 'text-foreground',
      borderClass: 'border-primary',
    },
    success: {
      icon: <FiCheckCircle className="w-4 h-4 flex-shrink-0" />,
      bgClass: 'bg-accent/10',
      textClass: 'text-accent',
      borderClass: 'border-accent/40',
    },
    error: {
      icon: <FiAlertCircle className="w-4 h-4 flex-shrink-0" />,
      bgClass: 'bg-destructive/10',
      textClass: 'text-destructive',
      borderClass: 'border-destructive/40',
    },
  }

  const c = config[status]

  return (
    <div className={`flex items-center gap-2 px-4 py-3 border-t ${c.bgClass} ${c.textClass} ${c.borderClass}`}>
      {c.icon}
      <span className="text-sm font-mono">{message}</span>
    </div>
  )
}

// --- Agent Info Component ---
function AgentInfoPanel({ activeAgentId }: { activeAgentId: string | null }) {
  return (
    <div className="border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 ${activeAgentId ? 'bg-accent animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-xs font-mono text-muted-foreground">{AGENT_NAME}</span>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-border text-muted-foreground">
          {activeAgentId ? 'Processing' : 'Ready'}
        </Badge>
      </div>
    </div>
  )
}

// --- Main Page ---
export default function Page() {
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)
  const [status, setStatus] = useState<StatusType>('idle')
  const [statusMessage, setStatusMessage] = useState('Select an image or take a screenshot to begin')
  const [loading, setLoading] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [showSampleData, setShowSampleData] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sourceType, setSourceType] = useState<'file' | 'screenshot' | null>(null)
  const [screenshotSupported, setScreenshotSupported] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Check if Screen Capture API is available
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setScreenshotSupported(false)
    }
  }, [])

  // Effective data (real or sample)
  const effectiveResult = showSampleData ? SAMPLE_RESULT : ocrResult
  const effectiveStatus = showSampleData ? 'success' as StatusType : status
  const effectiveStatusMessage = showSampleData
    ? 'Conversion complete! Saved as invoice_2024_0847.wrt'
    : statusMessage
  const effectiveImagePreview = showSampleData
    ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMyZDJkMmQiLz48dGV4dCB4PSIxNTAiIHk9IjkwIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjZjhmOGYyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JTlZPSUNFICMyMDI0LTA4NDc8L3RleHQ+PHRleHQgeD0iMTUwIiB5PSIxMTUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTEiIGZpbGw9IiM3NWI1YWEiIHRleHQtYW5jaG9yPSJtaWRkbGUiPnNhbXBsZV9pbnZvaWNlLnBuZzwvdGV4dD48L3N2Zz4='
    : imagePreviewUrl
  const effectiveFileName = showSampleData ? 'sample_invoice.png' : selectedFile?.name

  // Handlers
  const handleSelectImage = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setOcrResult(null)
    setSourceType('file')

    // Create image preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreviewUrl(ev.target?.result as string)
    }
    reader.readAsDataURL(file)

    setStatus('loaded')
    setStatusMessage(`Image loaded: ${file.name}. Ready to convert.`)
  }, [])

  const handleScreenshot = useCallback(async () => {
    try {
      setStatus('processing')
      setStatusMessage('Waiting for screen selection...')

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as MediaTrackConstraints,
      })

      // Create a video element to capture the frame
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()

      // Wait a brief moment for the video to stabilize
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Draw to canvas
      const canvas = canvasRef.current ?? document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        stream.getTracks().forEach((track) => track.stop())
        setStatus('error')
        setStatusMessage('Failed to capture screenshot. Canvas context unavailable.')
        return
      }
      ctx.drawImage(video, 0, 0)

      // Stop the stream immediately
      stream.getTracks().forEach((track) => track.stop())

      // Convert canvas to blob then to File
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) {
        setStatus('error')
        setStatusMessage('Failed to capture screenshot. Could not create image.')
        return
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const screenshotFile = new File([blob], `screenshot_${timestamp}.png`, { type: 'image/png' })

      // Set state
      setSelectedFile(screenshotFile)
      setOcrResult(null)
      setSourceType('screenshot')
      setImagePreviewUrl(canvas.toDataURL('image/png'))
      setStatus('loaded')
      setStatusMessage(`Screenshot captured: ${screenshotFile.name}. Ready to convert.`)
    } catch (err) {
      // User cancelled or permission denied
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setStatus('idle')
        setStatusMessage('Screenshot cancelled. Select an image to begin.')
      } else {
        setStatus('error')
        setStatusMessage(err instanceof Error ? err.message : 'Screenshot capture failed. Try selecting an image file instead.')
      }
    }
  }, [])

  const handleConvert = useCallback(async () => {
    if (!selectedFile) return

    setLoading(true)
    setStatus('processing')
    setStatusMessage('Processing... Extracting text')
    setActiveAgentId(AGENT_ID)
    setOcrResult(null)

    try {
      // Upload file first to get asset_id
      const uploadResult = await uploadFiles(selectedFile)

      if (!uploadResult.success || uploadResult.asset_ids.length === 0) {
        setStatus('error')
        setStatusMessage(`Upload failed: ${uploadResult.error ?? 'Could not upload image'}. Please try again.`)
        setLoading(false)
        setActiveAgentId(null)
        return
      }

      // Call agent with uploaded asset
      const agentMessage = `Extract all text from the uploaded image file "${selectedFile.name}" using OCR. Return the extracted text in the "extracted_text" field of your JSON response. Set status to "success" if text was found.`
      const result = await callAIAgent(agentMessage, AGENT_ID, {
        assets: uploadResult.asset_ids,
      })

      // Debug: log the full response structure to help diagnose issues
      console.log('[OCR Debug] Full agent response:', JSON.stringify(result, null, 2))

      if (result.success) {
        // Robust extraction: try multiple response paths
        const resp = result?.response
        const respResult = resp?.result
        const rawStr = result?.raw_response

        // Try to extract text from various possible response shapes
        const extractText = (): string => {
          // Path 1: Standard schema — response.result.extracted_text
          if (respResult?.extracted_text && typeof respResult.extracted_text === 'string') {
            return respResult.extracted_text
          }
          // Path 2: Text wrapped — response.result.text
          if (respResult?.text && typeof respResult.text === 'string') {
            return respResult.text
          }
          // Path 3: Content field — response.result.content
          if (respResult?.content && typeof respResult.content === 'string') {
            return respResult.content
          }
          // Path 4: Response field — response.result.response
          if (respResult?.response && typeof respResult.response === 'string') {
            return respResult.response
          }
          // Path 5: Message at response level — response.message
          if (resp?.message && typeof resp.message === 'string' && resp.message.length > 20) {
            return resp.message
          }
          // Path 6: Result is a string itself
          if (typeof respResult === 'string' && respResult.length > 0) {
            return respResult
          }
          // Path 7: Nested deeper — response.result.result (double-wrapped)
          if (respResult?.result && typeof respResult.result === 'object') {
            const inner = respResult.result
            if (inner?.extracted_text) return inner.extracted_text
            if (inner?.text) return inner.text
            if (inner?.content) return inner.content
          }
          if (respResult?.result && typeof respResult.result === 'string') {
            return respResult.result
          }
          // Path 8: Answer fields
          if (respResult?.answer && typeof respResult.answer === 'string') {
            return respResult.answer
          }
          if (respResult?.answer_text && typeof respResult.answer_text === 'string') {
            return respResult.answer_text
          }
          // Path 9: output field
          if (respResult?.output && typeof respResult.output === 'string') {
            return respResult.output
          }
          // Path 10: Iterate all string values in result looking for the longest one
          if (respResult && typeof respResult === 'object') {
            let longest = ''
            for (const key of Object.keys(respResult)) {
              const val = respResult[key]
              if (typeof val === 'string' && val.length > longest.length) {
                longest = val
              }
            }
            if (longest.length > 10) return longest
          }
          // Path 11: Try parsing raw_response if available
          if (rawStr && typeof rawStr === 'string') {
            try {
              const raw = JSON.parse(rawStr)
              if (raw?.extracted_text) return raw.extracted_text
              if (raw?.response?.extracted_text) return raw.response.extracted_text
              if (raw?.response?.result?.extracted_text) return raw.response.result.extracted_text
              if (raw?.text) return raw.text
              if (raw?.response?.text) return raw.response.text
            } catch {
              // raw_response isn't JSON — might be the text itself
              if (rawStr.length > 20 && !rawStr.startsWith('{')) return rawStr
            }
          }
          return ''
        }

        const extractedText = extractText()

        // Extract other metadata with fallbacks
        const agentStatus = respResult?.status ?? resp?.status ?? 'unknown'
        const agentMessage = respResult?.message ?? resp?.message ?? ''
        const agentFilename = respResult?.filename ?? selectedFile.name.replace(/\.[^.]+$/, '')
        const agentWordCount = respResult?.word_count ?? (extractedText ? extractedText.trim().split(/\s+/).filter(Boolean).length : 0)

        const data: OCRResult = {
          extracted_text: extractedText,
          status: typeof agentStatus === 'string' ? agentStatus : 'unknown',
          message: typeof agentMessage === 'string' ? agentMessage : '',
          filename: typeof agentFilename === 'string' ? agentFilename : selectedFile.name.replace(/\.[^.]+$/, ''),
          word_count: typeof agentWordCount === 'number' ? agentWordCount : (extractedText ? extractedText.trim().split(/\s+/).filter(Boolean).length : 0),
        }
        setOcrResult(data)

        console.log('[OCR Debug] Extracted data:', data)

        // Success if we got any meaningful text, regardless of status field value
        if (extractedText && extractedText.trim().length > 0) {
          setStatus('success')
          setStatusMessage(`Conversion complete! Saved as ${data.filename ?? 'output'}.wrt`)
        } else {
          setStatus('error')
          setStatusMessage(data.message || 'No text could be extracted from the image. Try a clearer image with more contrast.')
        }
      } else {
        setStatus('error')
        setStatusMessage(result?.error ?? 'Agent call failed. Please check your image and try again.')
      }
    } catch (err) {
      setStatus('error')
      setStatusMessage(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [selectedFile])

  const handleDownloadWrt = useCallback(async () => {
    const text = effectiveResult?.extracted_text
    if (!text) return

    const filename = effectiveResult?.filename ?? 'extracted_text'

    // Try server-side download first (more reliable in sandboxed environments)
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, filename }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${filename}.wrt`
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 1000)
        return
      }
    } catch {
      // Server route failed, fall through to client-side approach
    }

    // Fallback: client-side Blob download
    try {
      const blob = new Blob([text], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.wrt`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 1000)
    } catch {
      // Last resort: open in new window so user can save manually
      const w = window.open('', '_blank')
      if (w) {
        w.document.write(`<pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`)
        w.document.title = `${filename}.wrt`
        w.document.close()
      }
    }
  }, [effectiveResult])

  const handleCopyText = useCallback(async () => {
    const text = effectiveResult?.extracted_text
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [effectiveResult])

  const handleReset = useCallback(() => {
    setSelectedFile(null)
    setImagePreviewUrl(null)
    setOcrResult(null)
    setStatus('idle')
    setStatusMessage('Select an image or take a screenshot to begin')
    setSourceType(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const hasResult = effectiveResult && (effectiveResult.extracted_text?.length ?? 0) > 0

  return (
    <ErrorBoundary>
      <div style={THEME_VARS} className="min-h-screen bg-background text-foreground font-sans">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp"
          onChange={handleFileChange}
          className="hidden"
        />
        {/* Hidden canvas for screenshot capture */}
        <canvas ref={canvasRef} className="hidden" />

        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center flex-shrink-0">
                <FiFileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">OCR Image-to-WRT Converter</h1>
                <p className="text-sm text-muted-foreground">Extract text from images or screenshots and save as .wrt files.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground font-mono cursor-pointer select-none">
                Sample Data
              </Label>
              <Switch
                id="sample-toggle"
                checked={showSampleData}
                onCheckedChange={setShowSampleData}
              />
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Main Card */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-card-foreground">Image Source</CardTitle>
              <CardDescription className="text-muted-foreground text-xs font-mono">
                Upload an image file or capture a screenshot from your screen
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Image Preview Area */}
              <div className="border border-border bg-background">
                {effectiveImagePreview ? (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-center bg-secondary/50 border border-border overflow-hidden" style={{ maxHeight: '240px' }}>
                      <img
                        src={effectiveImagePreview}
                        alt="Selected image preview"
                        className="max-w-[300px] max-h-[200px] object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {sourceType === 'screenshot' ? (
                        <FiCamera className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <FiImage className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="font-mono text-xs text-foreground truncate">{effectiveFileName ?? 'image'}</span>
                      {sourceType === 'screenshot' && (
                        <Badge variant="outline" className="text-[10px] font-mono border-accent/40 text-accent px-1.5 py-0">
                          screenshot
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-6 border border-dashed border-muted-foreground/30 m-3">
                    <div className="flex items-center gap-4 mb-3">
                      <FiUpload className="w-7 h-7 text-muted-foreground" />
                      <span className="text-muted-foreground/40 text-lg font-mono">or</span>
                      <FiCamera className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">No image selected</p>
                    <p className="text-xs text-muted-foreground mt-1">Upload a file or take a screenshot to get started</p>
                  </div>
                )}
              </div>

              {/* Source Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleSelectImage}
                  disabled={loading || showSampleData}
                  className="flex-1 border-border font-mono text-sm"
                >
                  <FiUpload className="w-4 h-4 mr-2" />
                  Select Image
                </Button>
                {screenshotSupported && (
                  <Button
                    variant="outline"
                    onClick={handleScreenshot}
                    disabled={loading || showSampleData}
                    className="flex-1 border-border font-mono text-sm"
                  >
                    <FiMonitor className="w-4 h-4 mr-2" />
                    Screenshot
                  </Button>
                )}
              </div>

              {/* Convert + Reset */}
              <div className="flex gap-3">
                <Button
                  onClick={handleConvert}
                  disabled={(!selectedFile && !showSampleData) || loading || showSampleData}
                  className="flex-1 bg-primary text-primary-foreground font-mono text-sm hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <FiLoader className="w-4 h-4 mr-2 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <FiFileText className="w-4 h-4 mr-2" />
                      Convert
                    </>
                  )}
                </Button>
                {(selectedFile || ocrResult) && !showSampleData && (
                  <Button
                    variant="ghost"
                    onClick={handleReset}
                    disabled={loading}
                    className="text-muted-foreground hover:text-foreground font-mono text-sm px-3"
                  >
                    <FiX className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>

            {/* Status Bar */}
            <CardFooter className="flex-col items-stretch p-0">
              <StatusBar status={effectiveStatus} message={effectiveStatusMessage} />
            </CardFooter>
          </Card>

          {/* Results Card */}
          {hasResult && (
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FiCheckCircle className="w-4 h-4 text-accent" />
                    <CardTitle className="text-base font-semibold text-card-foreground">Extracted Text</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {(effectiveResult?.word_count ?? 0) > 0 && (
                      <Badge variant="secondary" className="font-mono text-xs bg-secondary text-secondary-foreground border border-border">
                        {effectiveResult?.word_count} words
                      </Badge>
                    )}
                    {effectiveResult?.filename && (
                      <Badge variant="outline" className="font-mono text-xs border-border text-muted-foreground">
                        {effectiveResult.filename}.wrt
                      </Badge>
                    )}
                  </div>
                </div>
                {effectiveResult?.message && (
                  <CardDescription className="text-xs font-mono text-muted-foreground mt-1">
                    {effectiveResult.message}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {/* Text Display */}
                <div className="border border-border bg-background">
                  <ScrollArea className="h-[300px]">
                    <pre className="p-4 text-sm font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed">
                      {effectiveResult?.extracted_text ?? ''}
                    </pre>
                  </ScrollArea>
                </div>

                {/* Result Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleDownloadWrt}
                    className="flex-1 bg-primary text-primary-foreground font-mono text-sm hover:bg-primary/90"
                  >
                    <FiDownload className="w-4 h-4 mr-2" />
                    Download as .wrt
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCopyText}
                    className="border-border font-mono text-sm"
                  >
                    {copied ? (
                      <>
                        <FiCheck className="w-4 h-4 mr-2 text-accent" />
                        Copied
                      </>
                    ) : (
                      <>
                        <FiCopy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                {/* Status badge */}
                {effectiveResult?.status && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs font-mono text-muted-foreground">Status:</span>
                    <Badge
                      variant={effectiveResult.status === 'success' ? 'default' : 'destructive'}
                      className={effectiveResult.status === 'success' ? 'font-mono text-xs bg-accent text-accent-foreground' : 'font-mono text-xs'}
                    >
                      {effectiveResult.status}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Agent Info */}
          <AgentInfoPanel activeAgentId={activeAgentId} />
        </div>
      </div>
    </ErrorBoundary>
  )
}
