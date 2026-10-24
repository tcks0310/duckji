// 사이트 표시 언어 (언어 선택기가 저장한 googtrans 쿠키 → localStorage 순으로 읽음)
// 언어를 바꾸면 페이지가 새로고침되므로 한 번만 읽으면 됩니다.
export function getSiteLanguage(): string {
  if (typeof window === "undefined") return "ko"
  try {
    const match = document.cookie.match(/googtrans=\/ko\/([^;]+)/)
    if (match && match[1]) return match[1]
    const stored = localStorage.getItem("dukji_preferred_lang")
    if (stored) return stored
  } catch (e) {}
  return "ko"
}
