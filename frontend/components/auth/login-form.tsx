"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { loginWithEmail, logoutMember, needsCode, SIGNUP_PATH } from "@/lib/member-auth"
import type { UserProfile } from "@/components/auth/types"
import { AuthShell, AuthTitle, Field, fieldClass, finishLogin, nextPath, Notice, PasswordInput, PrimaryButton, SocialButtons } from "@/components/auth/auth-shell"
import { EmailCodeStep } from "@/components/auth/email-code-step"

// 로그인 페이지 (/login, 로그인 뒤 ?next= 주소로 돌아감)
export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [codeStep, setCodeStep] = useState(false)
  const [current, setCurrent] = useState<UserProfile | null>(null)

  useEffect(() => {
    // 예전 주소(/login?tab=signup)는 가입 유형 선택으로
    if (new URLSearchParams(window.location.search).get("tab") === "signup") router.replace("/join/")
    try {
      const saved = localStorage.getItem("dukji_user")
      if (saved) setCurrent(JSON.parse(saved))
    } catch {
      // 저장된 정보가 깨졌으면 로그인 화면 그대로
    }
  }, [router])

  const doLogin = async () => {
    setError("")
    setBusy(true)
    const r = await loginWithEmail(email, password)
    setBusy(false)
    if (r.success) return finishLogin(router, r.user, nextPath())
    if (needsCode(r)) {
      setCodeStep(true)
      if (r.error) setError(r.error)
      return
    }
    if (r.signupRequired) return router.push(SIGNUP_PATH)
    setError(r.error)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    doLogin()
  }

  if (current) {
    return (
      <AuthShell>
        <AuthTitle title="이미 로그인되어 있어요" sub={`${current.name} 님${current.email ? ` (${current.email})` : ""}`} />
        <div className="space-y-3">
          <PrimaryButton onClick={() => router.push(nextPath())}>계속하기</PrimaryButton>
          <button
            type="button"
            onClick={async () => {
              await logoutMember()
              localStorage.removeItem("dukji_user")
              setCurrent(null)
            }}
            className="w-full h-12 rounded-lg border border-zinc-700 text-sm font-bold text-zinc-300 hover:text-white hover:border-zinc-500"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </AuthShell>
    )
  }

  if (codeStep) {
    return (
      <AuthShell>
        <AuthTitle title="이메일 인증" sub="가입할 때 메일 인증을 마치지 않은 계정이에요. 인증하면 바로 로그인돼요." />
        {error && (
          <div className="mb-6">
            <Notice>{error}</Notice>
          </div>
        )}
        <EmailCodeStep email={email.trim().toLowerCase()} onVerified={doLogin} />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthTitle title="로그인" />
      <form onSubmit={submit} className="space-y-5">
        <Field label="이메일">
          <input type="email" required autoComplete="email" placeholder="이메일 주소" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
        </Field>
        <Field label="비밀번호">
          <PasswordInput required autoComplete="current-password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <Notice>{error}</Notice>}
        <PrimaryButton type="submit" disabled={busy || !email || !password}>
          {busy ? "로그인 중..." : "로그인"}
        </PrimaryButton>
      </form>
      <div className="mt-5 flex items-center justify-center gap-4 text-sm text-zinc-400">
        <Link href={`/login/forgot/${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="hover:text-white">
          비밀번호 찾기
        </Link>
        <span className="w-px h-3 bg-zinc-700" />
        <Link href="/join/" className="hover:text-white">
          회원가입
        </Link>
      </div>
      <div className="mt-12">
        <SocialButtons title="SNS 계정으로 로그인" onError={setError} />
      </div>
    </AuthShell>
  )
}
