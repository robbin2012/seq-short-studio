"use client"

import type { MediaItem, StoryboardPanel, TimelineClip } from "./types"
import dynamic from "next/dynamic"
import { DEMO_FINAL_SEQUENCE } from "@/seq/lib/demo-data"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo } from "react"
import { useIsMobile } from "@/seq/hooks/use-is-mobile"
import { MobileEditorNotice } from "./components/mobile-editor-notice"

const Editor = dynamic(() => import("./components/editor").then((mod) => mod.Editor), { ssr: false })

interface SearchParamReader {
  get: (name: string) => string | null
  getAll: (name: string) => string[]
}

function joinRemoteUrl(base: string, file: string): string | null {
  try {
    if (/^https?:\/\//i.test(file)) {
      return new URL(file).toString()
    }

    const normalizedBase = base.endsWith("/") ? base : `${base}/`
    const normalizedFile = file.replace(/^\/+/, "")
    return new URL(normalizedFile, normalizedBase).toString()
  } catch {
    return null
  }
}

function buildRemoteMediaUrls(searchParams: SearchParamReader): string[] {
  const directUrls = searchParams
    .getAll("url")
    .map((value) => value.trim())
    .filter(Boolean)
  const base = (searchParams.get("base") || searchParams.get("prefix") || "").trim()
  const files = searchParams
    .getAll("file")
    .map((value) => value.trim())
    .filter(Boolean)

  const prefixedUrls = base
    ? files
        .map((file) => joinRemoteUrl(base, file))
        .filter((value): value is string => Boolean(value))
    : []

  return Array.from(new Set([...directUrls, ...prefixedUrls]))
}

function createDemoData() {
  const initialMedia: MediaItem[] = DEMO_FINAL_SEQUENCE.panels.map((p, i) => ({
    id: `media-${i}`,
    url: p.videoUrl,
    prompt: p.prompt,
    duration: p.duration,
    aspectRatio: DEMO_FINAL_SEQUENCE.videoConfig.aspectRatio,
    status: "ready" as const,
    type: "video" as const,
    resolution: { width: 1280, height: 720 },
  }))

  const initialClips: TimelineClip[] = []
  let startTime = 0

  initialMedia.forEach((m, i) => {
    initialClips.push({
      speed: 1,
      id: `clip-${i}`,
      mediaId: m.id,
      trackId: "v1",
      start: startTime,
      duration: m.duration,
      offset: 0,
      transition: undefined,
    })
    startTime += m.duration
  })

  const initialStoryboard: StoryboardPanel[] = DEMO_FINAL_SEQUENCE.panels.map((p, i) => ({
    id: `sb-${i}`,
    prompt: p.prompt,
    imageUrl: p.imageUrl,
    linkedImageUrl: p.linkedImageUrl,
    videoUrl: p.videoUrl,
    mediaId: `media-${i}`,
    status: "idle" as const,
    type: p.linkedImageUrl ? ("transition" as const) : ("scene" as const),
    duration: p.duration as 5 | 8,
  }))

  return { initialMedia, initialClips, initialStoryboard }
}

export { createDemoData }

function EditorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const remoteMediaUrls = useMemo(() => buildRemoteMediaUrls(searchParams), [searchParams])
  const loadDemo = searchParams.get("demo") === "true" && remoteMediaUrls.length === 0

  const isMobile = useIsMobile()
  if (isMobile) {
    return <MobileEditorNotice />
  }

  const demoData = loadDemo ? createDemoData() : null

  return (
    <Editor
      initialStoryboard={demoData?.initialStoryboard}
      initialMedia={demoData?.initialMedia}
      initialClips={demoData?.initialClips}
      initialRemoteMediaUrls={remoteMediaUrls}
      skipAutosaveRestore={remoteMediaUrls.length > 0}
      onBack={() => {
        router.push("/")
      }}
    />
  )
}

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-[var(--surface-0)] text-white">
          Loading editor...
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  )
}

export default App
