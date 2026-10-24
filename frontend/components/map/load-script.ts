const loading = new Map<string, Promise<void>>()

// 같은 SDK 스크립트를 한 번만 불러옵니다.
export function loadScript(id: string, src: string): Promise<void> {
  const existing = loading.get(id)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.id = id
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading.delete(id)
      script.remove()
      reject(new Error(`지도 SDK 를 불러오지 못했습니다: ${id}`))
    }
    document.head.appendChild(script)
  })
  loading.set(id, promise)
  return promise
}
