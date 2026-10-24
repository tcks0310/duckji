// 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
export const todayKst = (now = new Date()) =>
  new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
