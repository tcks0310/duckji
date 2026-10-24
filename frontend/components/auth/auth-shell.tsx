"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Eye, EyeOff } from "lucide-react"
import { loginWithKakao } from "@/lib/kakao-auth"
import { loginWithNaver } from "@/lib/naver-auth"
import { isAppleLoginEnabled, loginWithApple } from "@/lib/apple-auth"
import { loginWithGoogle } from "@/lib/google-auth"
import { isSignupRequired, SIGNUP_PATH } from "@/lib/member-auth"
import { userService } from "@/lib/user-service"
import { isAppMode } from "@/lib/app-mode"
import { useMyPageShortcuts } from "@/lib/saved-items"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import type { UserProfile } from "@/components/auth/types"

// 로그인·회원가입 페이지 공통 틀과 입력 부품 (/login, /login/forgot, /join, /join/korean, /signup)
// 다른 페이지처럼 사이트 위 메뉴줄·푸터 안에서, 가운데 좁은 입력 칸으로 보여 줌

export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const shortcuts = useMyPageShortcuts()
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <Navbar activeTab="" setActiveTab={() => {}} {...shortcuts} searchQuery="" setSearchQuery={() => {}} />
      <main className={`flex-1 w-full mx-auto px-4 pt-28 sm:pt-36 pb-20 app-nav-offset ${wide ? "max-w-[480px]" : "max-w-[400px]"}`}>{children}</main>
      <Footer />
    </div>
  )
}

export function AuthTitle({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {sub && <p className="mt-2 text-sm text-zinc-400">{sub}</p>}
    </div>
  )
}

// 단계 표시 (예: 약관 동의 → 정보 입력 → 이메일 인증 → 본인인증)
export function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2 min-w-0">
          <span
            className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-bold ${
              i < current ? "bg-red-600/30 text-red-300" : i === current ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </span>
          <span className={i === current ? "text-white font-bold whitespace-nowrap" : "hidden sm:inline text-zinc-500 whitespace-nowrap"}>{s}</span>
          {i < steps.length - 1 && <span className="w-3 h-px bg-zinc-700 shrink-0" />}
        </li>
      ))}
    </ol>
  )
}

export const fieldClass =
  "w-full h-12 rounded-lg bg-zinc-900 border border-zinc-700 px-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 disabled:opacity-60"

export function Field({
  label,
  hint,
  error,
  ok,
  children,
}: {
  label: string
  hint?: React.ReactNode
  error?: string | null
  ok?: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-zinc-200 mb-2">{label}</label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      ) : ok ? (
        <p className="mt-1.5 text-xs text-emerald-400">{ok}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`${fieldClass} pr-12`} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-200"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full h-12 rounded-lg bg-red-600 hover:bg-red-500 text-white text-base font-bold transition-colors disabled:opacity-40 disabled:hover:bg-red-600 ${props.className || ""}`}
    >
      {children}
    </button>
  )
}

export function Notice({ tone = "error", children }: { tone?: "error" | "info" | "ok"; children: React.ReactNode }) {
  const color =
    tone === "error"
      ? "border-red-900/70 bg-red-950/40 text-red-300"
      : tone === "ok"
        ? "border-emerald-900/70 bg-emerald-950/30 text-emerald-300"
        : "border-zinc-700 bg-zinc-900 text-zinc-300"
  return <div className={`rounded-lg border px-4 py-3 text-sm ${color}`}>{children}</div>
}

// 로그인한 회원 정보를 화면용으로 저장하고 다음 페이지로
export function finishLogin(router: ReturnType<typeof useRouter>, user: UserProfile, next = "/") {
  localStorage.setItem("dukji_user", JSON.stringify(user))
  userService.registerOrUpdateUser(user)
  // 덕지 앱은 화면을 새로 열어 상단·메뉴까지 로그인 상태로 바꿈
  if (isAppMode()) window.location.href = next
  else router.push(next)
}

// 로그인 뒤 돌아갈 주소 (/login?next=/store/goods/cart/). 다른 사이트 주소는 무시
export function nextPath() {
  if (typeof window === "undefined") return "/"
  const n = new URLSearchParams(window.location.search).get("next") || "/"
  return n.startsWith("/") && !n.startsWith("//") ? n : "/"
}

type Provider = "kakao" | "naver" | "google" | "apple"

// 카카오·네이버·구글·애플 로그인 (처음이면 가입 정보 입력 페이지로)
export function useSocialLogin(onError: (message: string) => void) {
  const router = useRouter()
  const [busy, setBusy] = useState<Provider | null>(null)
  const login = async (provider: Provider) => {
    setBusy(provider)
    try {
      const user =
        provider === "kakao" ? await loginWithKakao() : provider === "naver" ? await loginWithNaver() : provider === "apple" ? await loginWithApple() : await loginWithGoogle()
      finishLogin(router, user, nextPath())
    } catch (err: any) {
      if (isSignupRequired(err)) return router.push(SIGNUP_PATH)
      const msg = String(err?.error_description || err?.message || "")
      const canceled = err?.error === "access_denied" || /cancel|User denied|닫혔|closed|popup_closed/i.test(msg)
      if (!canceled) {
        console.error(`${provider} login error`, err)
        onError(msg ? `로그인하지 못했어요. ${msg}` : "로그인하지 못했어요. 잠시 후 다시 시도해 주세요.")
      }
    } finally {
      setBusy(null)
    }
  }
  return { login, busy }
}

const SOCIALS: { id: Provider; label: string; className: string; icon: React.ReactNode }[] = [
  {
    id: "kakao",
    label: "카카오",
    className: "bg-[#FEE500] text-[#191919]",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3C6.48 3 2 6.58 2 11c0 2.87 1.89 5.39 4.74 6.74-.21.77-.77 2.78-.88 3.22-.14.54.2.54.42.39.29-.2 4.02-2.73 4.67-3.18.35.05.7.08 1.05.08 5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
      </svg>
    ),
  },
  { id: "naver", label: "네이버", className: "bg-[#03C75A] text-white", icon: <span className="text-base font-black">N</span> },
  {
    id: "google",
    label: "구글",
    className: "bg-white",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
      </svg>
    ),
  },
  // 애플: Services ID(NEXT_PUBLIC_APPLE_CLIENT_ID)가 있을 때만 보임
  ...(isAppleLoginEnabled()
    ? [
        {
          id: "apple" as const,
          label: "애플",
          className: "bg-white text-black",
          icon: (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden>
              <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.65zM14.1 5.84c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.6-2.66 1.37-.58.67-1.09 1.76-.95 2.8 1.01.08 2.04-.51 2.67-1.28z" />
            </svg>
          ),
        },
      ]
    : []),
]

export function SocialButtons({ title, onError }: { title: string; onError: (message: string) => void }) {
  const { login, busy } = useSocialLogin(onError)
  return (
    <div>
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="flex-1 h-px bg-zinc-800" />
        <span>{title}</span>
        <span className="flex-1 h-px bg-zinc-800" />
      </div>
      <div className="mt-5 flex justify-center gap-8">
        {SOCIALS.map((s) => (
          <button key={s.id} type="button" onClick={() => login(s.id)} disabled={busy !== null} className="flex flex-col items-center gap-2 group disabled:opacity-50">
            <span className={`w-12 h-12 rounded-full flex items-center justify-center group-hover:opacity-90 ${s.className}`}>{s.icon}</span>
            <span className="text-xs text-zinc-400 group-hover:text-white">{busy === s.id ? "연결 중..." : s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// 약관 동의 체크 줄
export function CheckRow({
  checked,
  onChange,
  label,
  href,
  strong = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: React.ReactNode
  href?: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <label className={`flex flex-1 items-center gap-3 cursor-pointer ${strong ? "text-base font-bold text-white" : "text-sm text-zinc-300"}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-red-600 shrink-0" />
        <span>{label}</span>
      </label>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 underline hover:text-white shrink-0">
          보기
        </a>
      )}
    </div>
  )
}
