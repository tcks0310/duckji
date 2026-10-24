"use client"

// 덕지 AI 대화 (backend ai-chat 서비스). 홈 검색창 'AI 대화' 버튼을 누르면 검색창 자리에서 바로 대화함.
// openAiChat 은 그 검색창을 AI 대화로 바꿈 (다른 화면에서 질문을 넘길 때).
// AI 를 쓸 수 없을 때(키 없음·크레딧 부족·서버 미배포)는 사이트 안 검색 결과로 대신 답함
import { apiFetch } from "@/lib/api"
import { searchSite } from "@/lib/site-search"
import { popupDetailHref } from "@/lib/popup-service"

// 홈 검색창을 AI 대화로 바꾸는 이벤트
export const OPEN_AI_CHAT_EVENT = "dukji:open-ai-chat"

// AI 가 할 수 있는 일. 대화가 비어 있을 때 눌러 볼 수 있는 질문 칩으로 보여 줌
export const AI_CHAT_ABILITIES: { label: string; hint: string; prompt: string }[] = [
  { label: "팝업·펀딩 찾기", hint: "덕지에 등록된 팝업·펀딩·팬 파티·게시글 찾아 주기", prompt: "지금 진행 중인 팝업 알려줘" },
  { label: "팬 파티 찾기", hint: "다가오는 팬 생일 파티와 모임 찾아 주기", prompt: "다가오는 팬 생일 파티 알려줘" },
  { label: "동선 짜기", hint: "팝업 방문 동선과 순서 짜기", prompt: "성수에서 팝업 여러 곳 도는 동선 짜 줘" },
  { label: "이용 방법", hint: "사이트 이용 방법 안내", prompt: "덕지 포인트는 어떻게 모아?" },
]

// 빠른 AI 길라잡이 질문 (예전 홈 오른쪽 길라잡이 칸에 있던 버튼, 2026-10-18 검색창 'AI 대화' 안으로 옮김)
export const AI_QUICK_QUESTIONS: { label: string; prompt: string }[] = [
  { label: "오늘 착장", prompt: "오늘 성지순례 추천 착장과 행운색은?" },
  { label: "덕질 운세", prompt: "오늘 사주명리 천문물상 운세 어때?" },
  { label: "순례 코스", prompt: "외국인/마니아 인기 1위 성지순례 코스는?" },
  { label: "파티 펀딩", prompt: "홍대 파티룸 모임 펀딩 현황 알려줘!" },
]

export interface AiChatLink {
  kind: string
  title: string
  href: string
}

export interface AiChatTurn {
  role: "user" | "assistant"
  content: string
}

export interface AiChatReply {
  text: string
  links: AiChatLink[]
  fromAi: boolean
  // AI 를 쓸 수 없어 사이트 검색 결과로 대신 답했을 때 그 검색어 (검색 결과 페이지 링크용)
  fallbackQuery?: string
}

export function openAiChat(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_AI_CHAT_EVENT, { detail: { prompt } }))
}

export async function askAi(history: AiChatTurn[]): Promise<AiChatReply> {
  try {
    const res = await apiFetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
    const json = await res.json().catch(() => null)
    if (res.status === 429 && json?.error) return { text: json.error, links: [], fromAi: false }
    if (res.ok && json?.success && json.available) {
      return {
        text: json.reply,
        links: (json.links || []).map((l: any) => ({ kind: l.kind, title: l.title, href: l.href })),
        fromAi: true,
      }
    }
  } catch {
    // 서버 미배포·네트워크 오류 → 아래 사이트 검색으로 대신 답함
  }
  return searchFallback(history[history.length - 1]?.content || "")
}

async function searchFallback(question: string): Promise<AiChatReply> {
  const q = question.trim().slice(0, 60)
  const r = await searchSite(q, 4).catch(() => null)
  const links: AiChatLink[] = []
  if (r) {
    r.popups.forEach((p) => links.push({ kind: "팝업", title: p.title, href: popupDetailHref(p.id) }))
    r.fundings.forEach((f) => links.push({ kind: "펀딩", title: f.title, href: `/funding/detail/?id=${encodeURIComponent(f.id)}` }))
    r.parties.forEach((e) => links.push({ kind: "파티", title: e.title, href: `/funding/party/event?slug=${encodeURIComponent(e.slug)}` }))
    r.posts.forEach((p) => links.push({ kind: "게시글", title: p.title, href: `/community/gallery/post/?id=${p.id}` }))
  }
  const top = links.slice(0, 6)
  return {
    fallbackQuery: q,
    text: top.length
      ? `지금은 AI 답변을 준비 중이에요. 대신 덕지에서 '${q}'(으)로 찾은 결과를 보여 드릴게요.`
      : `지금은 AI 답변을 준비 중이에요. 덕지에서 '${q}'(으)로 찾은 결과도 없네요. 작품명이나 장소처럼 짧은 단어로 다시 물어봐 주세요.`,
    links: top,
    fromAi: false,
  }
}
