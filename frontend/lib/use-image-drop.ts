"use client"

import { useRef, useState, type DragEvent } from "react"

// 이미지 끌어다 놓기: 영역에 dropProps 를 붙이면 놓은 이미지 파일을 onFiles 로 넘김
// dragging 동안은 영역에 강조 표시(dropHighlight)를 붙여 놓을 수 있다는 걸 알려 줌
export const dropHighlight = "ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-zinc-950 rounded-xl"

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files")

// accept: 받을 파일 종류 (기본은 이미지만, 갤러리 글쓰기는 동영상도)
export function useImageDrop(onFiles: (files: File[]) => void, disabled = false, accept: (f: File) => boolean = (f) => f.type.startsWith("image/")) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0) // 자식 요소를 지날 때 생기는 enter/leave 짝 맞추기

  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (disabled || !hasFiles(e)) return
      e.preventDefault()
      depth.current += 1
      setDragging(true)
    },
    onDragOver: (e: DragEvent) => {
      if (disabled || !hasFiles(e)) return
      e.preventDefault() // 기본 동작(브라우저가 파일을 열기)을 막아야 drop 이 옴
      e.dataTransfer.dropEffect = "copy"
    },
    onDragLeave: (e: DragEvent) => {
      if (disabled || !hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      if (disabled) return
      const files = Array.from(e.dataTransfer.files).filter(accept)
      if (files.length) onFiles(files)
    },
  }
  return { dragging, dropProps }
}
