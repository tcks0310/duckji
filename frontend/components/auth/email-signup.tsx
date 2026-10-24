"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { loginWithEmail, needsCode, SIGNUP_PATH, signupWithEmail } from "@/lib/member-auth"
import { AuthShell, AuthTitle, CheckRow, Field, fieldClass, finishLogin, Notice, PasswordInput, PrimaryButton, SocialButtons, StepBar } from "@/components/auth/auth-shell"
import { EmailCodeStep } from "@/components/auth/email-code-step"

// 내국인 회원가입 (/join/korean): 약관 동의 → 정보 입력 → 이메일 인증 → 휴대폰 본인인증(/signup)
// 카카오·네이버·구글로 가입하면 약관 동의 뒤 바로 /signup 에서 본인인증·닉네임을 받음
export const SIGNUP_STEPS = ["약관 동의", "정보 입력", "이메일 인증", "본인인증"]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 서버(auth)와 같은 규칙: 영문·숫자 포함 8~100자
export function passwordProblem(pw: string) {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 해요."
  if (pw.length > 100) return "비밀번호가 너무 길어요."
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "영문과 숫자를 모두 넣어 주세요."
  return null
}

export function EmailSignup() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [agree, setAgree] = useState({ age: false, terms: false, privacy: false, marketing: false })
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [name, setName] = useState("")
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [error, setError] = useState("")
  const [existing, setExisting] = useState(false)
  const [busy, setBusy] = useState(false)

  const required = agree.age && agree.terms && agree.privacy
  const all = required && agree.marketing
  const setAll = (v: boolean) => setAgree({ age: v, terms: v, privacy: v, marketing: v })

  const emailError = touched.email && !EMAIL_RE.test(email.trim()) ? "이메일 주소 형식을 확인해 주세요." : null
  const pwError = touched.password ? passwordProblem(password) : null
  const pw2Error = touched.password2 && password2 !== password ? "비밀번호가 서로 달라요." : null
  const nameError = touched.name && (name.trim().length < 2 || name.trim().length > 20) ? "닉네임은 2~20자로 정해 주세요." : null
  const formOk = EMAIL_RE.test(email.trim()) && !passwordProblem(password) && password === password2 && name.trim().length >= 2 && name.trim().length <= 20

  const submitInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true, password2: true, name: true })
    if (!formOk) return
    setError("")
    setBusy(true)
    const r = await signupWithEmail({ email, password, name: name.trim(), agreements: agree })
    setBusy(false)
    if (needsCode(r)) {
      setExisting(Boolean(r.existing))
      return setStep(2)
    }
    if (r.success) return finishLogin(router, r.user) // Cognito 없는 로컬 개발
    if (r.signupRequired) return router.push(SIGNUP_PATH)
    setError(r.error)
  }

  // 메일 인증을 마치면 로그인 → 회원 정보가 아직 없으니 본인인증 페이지(/signup)로
  const afterVerified = async () => {
    setError("")
    const r = await loginWithEmail(email, password)
    if (r.success) return finishLogin(router, r.user)
    if (!needsCode(r) && r.signupRequired) return router.push(SIGNUP_PATH)
    setError(
      existing
        ? "예전에 가입하다 멈춘 계정이라 그때 정한 비밀번호가 남아 있어요. 비밀번호 찾기에서 새 비밀번호를 정한 뒤 로그인해 주세요."
        : r.error || "로그인하지 못했어요."
    )
  }

  return (
    <AuthShell wide>
      <AuthTitle title="회원가입" />
      <StepBar steps={SIGNUP_STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-8">
          <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800">
            <div className="p-4">
              <CheckRow strong checked={all} onChange={setAll} label="전체 동의하기" />
              <p className="mt-1.5 pl-8 text-xs text-zinc-500">선택 항목(마케팅 수신)도 함께 동의해요.</p>
            </div>
            <div className="p-4 space-y-3.5">
              <CheckRow checked={agree.age} onChange={(v) => setAgree({ ...agree, age: v })} label="[필수] 만 14세 이상입니다" />
              <CheckRow checked={agree.terms} onChange={(v) => setAgree({ ...agree, terms: v })} label="[필수] 서비스 이용약관 동의" href="/terms/" />
              <CheckRow checked={agree.privacy} onChange={(v) => setAgree({ ...agree, privacy: v })} label="[필수] 개인정보 수집 및 이용 동의" href="/privacy/" />
              <CheckRow checked={agree.marketing} onChange={(v) => setAgree({ ...agree, marketing: v })} label="[선택] 신규 팝업 오픈 알림·마케팅 수신 동의" />
            </div>
          </div>
          <PrimaryButton type="button" disabled={!required} onClick={() => setStep(1)}>
            이메일로 가입하기
          </PrimaryButton>
          {error && <Notice>{error}</Notice>}
          <SocialButtons title="SNS 계정으로 간편 가입" onError={setError} />
          <p className="text-center text-xs text-zinc-500">SNS 로 가입해도 다음 화면에서 휴대폰 본인인증과 약관 동의를 한 번 더 확인해요.</p>
        </div>
      )}

      {step === 1 && (
        <form onSubmit={submitInfo} className="space-y-5" noValidate>
          <Field label="이메일" hint="로그인 아이디로 써요. 인증 코드를 받을 수 있는 주소를 적어 주세요." error={emailError}>
            <input
              type="email"
              autoComplete="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched({ ...touched, email: true })}
              className={fieldClass}
            />
          </Field>
          <Field label="비밀번호" hint="영문과 숫자를 섞어 8자 이상" error={pwError} ok={password && !passwordProblem(password) ? "사용할 수 있는 비밀번호예요." : null}>
            <PasswordInput
              autoComplete="new-password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched({ ...touched, password: true })}
            />
          </Field>
          <Field label="비밀번호 확인" error={pw2Error} ok={password2 && password2 === password ? "비밀번호가 같아요." : null}>
            <PasswordInput
              autoComplete="new-password"
              placeholder="비밀번호 다시 입력"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              onBlur={() => setTouched({ ...touched, password2: true })}
            />
          </Field>
          <Field label="닉네임" hint="2~20자, 사이트에 보이는 이름이에요." error={nameError}>
            <input
              type="text"
              maxLength={20}
              placeholder="성지탐험가"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched({ ...touched, name: true })}
              className={fieldClass}
            />
          </Field>
          {error && (
            <Notice>
              {error}
              {/이미 가입/.test(error) && (
                <>
                  {" "}
                  <Link href="/login/" className="underline font-bold">
                    로그인하기
                  </Link>
                </>
              )}
            </Notice>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStep(0)} className="w-28 h-12 rounded-lg border border-zinc-700 text-sm font-bold text-zinc-300 hover:text-white">
              이전
            </button>
            <PrimaryButton type="submit" disabled={busy} className="flex-1">
              {busy ? "가입 중..." : "다음"}
            </PrimaryButton>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {error && (
            <Notice>
              {error}{" "}
              {existing && (
                <Link href={`/login/forgot/?email=${encodeURIComponent(email.trim().toLowerCase())}`} className="underline font-bold">
                  비밀번호 찾기
                </Link>
              )}
            </Notice>
          )}
          <EmailCodeStep
            email={email.trim().toLowerCase()}
            onVerified={afterVerified}
            intro={existing ? "예전에 가입하다 인증을 마치지 않은 이메일이라 인증 코드를 새로 보냈어요. " : undefined}
          />
        </div>
      )}

      <p className="mt-10 text-center text-sm text-zinc-400">
        이미 회원이신가요?{" "}
        <Link href="/login/" className="font-bold text-white underline">
          로그인
        </Link>
      </p>
    </AuthShell>
  )
}
