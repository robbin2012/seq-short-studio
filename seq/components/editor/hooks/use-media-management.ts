"use client"

import { useCallback, useRef } from "react"
import type { MediaItem } from "../types"

interface UseMediaManagementProps {
  defaultDuration: number
  onMediaAdd: (media: MediaItem) => void
  onMediaUpdate: (id: string, updates: Partial<MediaItem>) => void
}

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv", "ogv"])
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"])
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"])

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height

  if (Math.abs(ratio - 16 / 9) < 0.1) return "16:9"
  if (Math.abs(ratio - 9 / 16) < 0.1) return "9:16"
  if (Math.abs(ratio - 1) < 0.1) return "1:1"

  return "custom"
}

function inferRemoteMediaType(url: string): MediaItem["type"] {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const extension = pathname.split(".").pop() || ""

    if (AUDIO_EXTENSIONS.has(extension)) return "audio"
    if (IMAGE_EXTENSIONS.has(extension)) return "image"
    if (VIDEO_EXTENSIONS.has(extension)) return "video"
  } catch {
    // Fall back to video below
  }

  return "video"
}

function deriveRemoteLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split("/").filter(Boolean).pop()
    return filename ? decodeURIComponent(filename) : "Remote Media"
  } catch {
    return url
  }
}

export function useMediaManagement({ defaultDuration, onMediaAdd, onMediaUpdate }: UseMediaManagementProps) {
  const objectUrlsRef = useRef<string[]>([])

  const loadMediaMetadata = useCallback(
    (id: string, sourceUrl: string, type: MediaItem["type"]) => {
      if (type === "image") {
        const image = new Image()
        image.crossOrigin = "anonymous"
        image.onload = () => {
          onMediaUpdate(id, {
            resolution: { width: image.naturalWidth, height: image.naturalHeight },
            aspectRatio: getAspectRatio(image.naturalWidth, image.naturalHeight),
          })
        }
        image.onerror = () => onMediaUpdate(id, { status: "error" })
        image.src = sourceUrl
        return
      }

      const el = type === "audio" ? document.createElement("audio") : document.createElement("video")
      el.crossOrigin = "anonymous"
      el.preload = "metadata"

      el.onloadedmetadata = () => {
        const updates: Partial<MediaItem> = {
          duration: el.duration,
        }

        if (type === "video") {
          const videoEl = el as HTMLVideoElement
          updates.resolution = { width: videoEl.videoWidth, height: videoEl.videoHeight }
          updates.aspectRatio = getAspectRatio(videoEl.videoWidth, videoEl.videoHeight)
        }

        onMediaUpdate(id, updates)
      }

      el.onerror = () => onMediaUpdate(id, { status: "error" })
      el.src = sourceUrl
    },
    [onMediaUpdate],
  )

  const handleImport = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      const newId = Math.random().toString(36).substr(2, 9)
      const isAudio = file.type.startsWith("audio")

      const newMedia: MediaItem = {
        id: newId,
        url,
        prompt: file.name,
        duration: defaultDuration,
        aspectRatio: "16:9",
        status: "ready",
        type: isAudio ? "audio" : "video",
      }

      const el = isAudio ? document.createElement("audio") : document.createElement("video")
      el.crossOrigin = "anonymous"

      el.onloadedmetadata = () => {
        const updates: Partial<MediaItem> = {
          duration: el.duration,
        }

        if (!isAudio) {
          const videoEl = el as HTMLVideoElement
          const r = videoEl.videoWidth / videoEl.videoHeight
          updates.resolution = { width: videoEl.videoWidth, height: videoEl.videoHeight }

          if (Math.abs(r - 16 / 9) < 0.1) updates.aspectRatio = "16:9"
          else if (Math.abs(r - 9 / 16) < 0.1) updates.aspectRatio = "9:16"
          else if (Math.abs(r - 1) < 0.1) updates.aspectRatio = "1:1"
          else updates.aspectRatio = "custom"
        }

        onMediaUpdate(newId, updates)
      }

      el.src = url
      onMediaAdd(newMedia)
    },
    [defaultDuration, onMediaAdd, onMediaUpdate],
  )

  const handleImportUrl = useCallback(
    (url: string) => {
      const trimmedUrl = url.trim()
      if (!trimmedUrl) return

      const mediaType = inferRemoteMediaType(trimmedUrl)
      const newId = Math.random().toString(36).substr(2, 9)
      const label = deriveRemoteLabel(trimmedUrl)

      const newMedia: MediaItem = {
        id: newId,
        url: trimmedUrl,
        prompt: label,
        duration: mediaType === "image" ? 5 : defaultDuration,
        aspectRatio: "16:9",
        status: "ready",
        type: mediaType,
      }

      onMediaAdd(newMedia)
      loadMediaMetadata(newId, trimmedUrl, mediaType)
    },
    [defaultDuration, loadMediaMetadata, onMediaAdd],
  )

  const cleanup = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
  }, [])

  return {
    handleImport,
    handleImportUrl,
    cleanup,
    objectUrlsRef,
  }
}
