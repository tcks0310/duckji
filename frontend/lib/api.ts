// backend API 주소 (로컬: http://localhost:4000, 배포: https://api.duckji.com)
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "")

// 관리자 세션 쿠키를 주고받기 위해 credentials 포함
export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE_URL}${path}`, { credentials: "include", ...init })
}
