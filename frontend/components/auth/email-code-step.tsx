"use client"

import * as React from "react"
import { useState } from "react"
import { confirmEmailCode, resendEmailCode } from "@/lib/member-auth"
import { Field, fieldClass, Notice, PrimaryButton } from "@/components/auth/auth-shell"

// 메일로 받은 인증 코드 입력 (이메일 가입 직후, 인증 전 계정으로 로그인할 때)
export function EmailCodeStep({ email, onVerified, intro }: { email: string; onVerified: () => Promise<void> | void; intro?: React.ReactNode }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setBusy(true)
    const r = await confirmEmailCode(email, code)
    if (!r.success) {
      setBusy(false)
      return setError(r.error)
    }
    await onVerified()
    setBusy(false)
  }

  const resend = async () => {
    setError("")
    setInfo("")
    const r = await resendEmailCode(email)
    if (r.success) setInfo("인증 코드를 다시 보냈어요. 메일함을 확인해 주세요.")
    else setError(r.error)
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Notice tone="info">
        {intro}
        <b className="text-white">{email}</b> 으로 인증 코드를 보냈어요. 메일이 안 보이면 스팸함도 확인해 주세요. (보내는 주소 no-reply@verificationemail.com)
      </Notice>
      <Field label="인증 코드" error={error} ok={info}>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          placeholder="숫자 6자리"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className={`${fieldClass} tracking-[0.3em]`}
          autoFocus
        />
      </Field>
      <PrimaryButton type="submit" disabled={busy || code.length < 4}>
        {busy ? "확인 중..." : "인증하기"}
      </PrimaryButton>
      <p className="text-center text-sm text-zinc-400">
        코드를 못 받으셨나요?{" "}
        <button type="button" onClick={resend} className="font-bold text-white underline">
          다시 보내기
        </button>
      </p>
    </form>
  )
}
