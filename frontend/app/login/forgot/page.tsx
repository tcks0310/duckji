"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { requestPasswordReset, resetPassword } from "@/lib/member-auth"
import { AuthShell, AuthTitle, Field, fieldClass, Notice, PasswordInput, PrimaryButton } from "@/components/auth/auth-shell"
import { passwordProblem } from "@/components/auth/email-signup"

// 비밀번호 찾기 (/login/forgot): 이메일로 코드 받기 → 코드와 새 비밀번호 입력
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [step, setStep] = useState<"email" | "reset" | "done">("email")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("email")
    if (e) setEmail(e)
  }, [])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setBusy(true)
    const r = await requestPasswordReset(email)
    setBusy(false)
    if (!r.success) return setError(r.error)
    setStep("reset")
  }

  const reset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const problem = passwordProblem(password)
    if (problem) return setError(problem)
    if (password !== password2) return setError("비밀번호가 서로 달라요.")
    setBusy(true)
    const r = await resetPassword(email, code.trim(), password)
    setBusy(false)
    if (!r.success) return setError(r.error)
    setStep("done")
  }

  return (
    <AuthShell>
      <AuthTitle title="비밀번호 찾기" sub={step === "email" ? "가입한 이메일로 비밀번호 재설정 코드를 보내 드려요." : undefined} />
      {step === "email" && (
        <form onSubmit={send} className="space-y-5">
          <Field label="이메일">
            <input type="email" required placeholder="가입한 이메일 주소" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
          </Field>
          {error && <Notice>{error}</Notice>}
          <PrimaryButton type="submit" disabled={busy || !email}>
            {busy ? "보내는 중..." : "재설정 코드 받기"}
          </PrimaryButton>
        </form>
      )}
      {step === "reset" && (
        <form onSubmit={reset} className="space-y-5">
          <Notice tone="info">
            <b className="text-white">{email}</b> 으로 코드를 보냈어요. 가입된 이메일이 아니면 메일이 가지 않아요. 스팸함도 확인해 주세요.
          </Notice>
          <Field label="재설정 코드">
            <input inputMode="numeric" maxLength={8} placeholder="숫자 6자리" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={fieldClass} />
          </Field>
          <Field label="새 비밀번호" hint="영문과 숫자를 섞어 8자 이상">
            <PasswordInput autoComplete="new-password" placeholder="새 비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="새 비밀번호 확인" error={password2 && password !== password2 ? "비밀번호가 서로 달라요." : null}>
            <PasswordInput autoComplete="new-password" placeholder="새 비밀번호 다시 입력" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </Field>
          {error && <Notice>{error}</Notice>}
          <PrimaryButton type="submit" disabled={busy || code.length < 4 || !password || !password2}>
            {busy ? "바꾸는 중..." : "비밀번호 바꾸기"}
          </PrimaryButton>
        </form>
      )}
      {step === "done" && (
        <div className="space-y-6">
          <Notice tone="ok">비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.</Notice>
          <Link href="/login/" className="flex items-center justify-center w-full h-12 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold">
            로그인하러 가기
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
