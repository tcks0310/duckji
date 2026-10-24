"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, User, ShieldCheck, ArrowRight, ArrowLeft, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trackSignup } from "@/lib/analytics"
import { cancelSignup, completeSignup, getPendingSignup, type PendingSignup } from "@/lib/member-auth"
import { PhoneVerification, type PhoneState } from "@/components/auth/phone-verification"
import { userService } from "@/lib/user-service"
import { loadPoints } from "@/lib/member-points"
import { AuthShell, AuthTitle, StepBar } from "@/components/auth/auth-shell"
import { SIGNUP_STEPS } from "@/components/auth/email-signup"
import { checkReferralCode, forgetReferralCode, normalizeReferralCode, rememberedReferralCode, type ReferralCheck } from "@/lib/referral"

// 회원가입 정보 입력: 카카오·네이버·구글·이메일로 처음 로그인하면 여기로 옴
// 닉네임·휴대폰(본인인증 또는 문자 인증)·필수 약관을 받아야 회원이 만들어짐. 화면은 로그인 페이지 스타일을 그대로 씀

const signupInput =
  "w-full h-12 bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 disabled:text-zinc-400"

const PROVIDER_LABEL: Record<string, string> = {
  kakao: "카카오",
  naver: "네이버",
  google: "Google",
  apple: "Apple",
  cognito: "이메일",
  email: "이메일",
}

export default function SignupPage() {
  const router = useRouter()
  const [pending, setPending] = useState<PendingSignup | null | undefined>(undefined)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phoneState, setPhoneState] = useState<PhoneState>({ phone: "", ready: false })
  const [agreeAll, setAgreeAll] = useState(false)
  const [agreeAge, setAgreeAge] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [notice, setNotice] = useState("")
  // 추천인 ID (선택): 추천 링크로 들어왔으면 미리 채워 둠
  const [referral, setReferral] = useState("")
  const [referralCheck, setReferralCheck] = useState<(ReferralCheck & { input: string }) | null>(null)
  const [referralChecking, setReferralChecking] = useState(false)

  const verifyReferral = async (value: string) => {
    const code = normalizeReferralCode(value)
    if (!code) return null
    setReferralChecking(true)
    const result = { ...(await checkReferralCode(code)), input: code }
    setReferralChecking(false)
    setReferralCheck(result)
    return result
  }

  useEffect(() => {
    const remembered = rememberedReferralCode()
    if (remembered) {
      setReferral(remembered)
      verifyReferral(remembered)
    }
  }, [])

  useEffect(() => {
    getPendingSignup().then((p) => {
      setPending(p)
      if (!p) return
      setName(p.name || "")
      setEmail(p.email || "")
      // 이메일 가입 화면에서 이미 동의한 항목은 체크해 둠
      if (p.consents) {
        setAgreeAge(Boolean(p.consents.age_14))
        setAgreeTerms(Boolean(p.consents.terms))
        setAgreePrivacy(Boolean(p.consents.privacy_required))
        setAgreeMarketing(Boolean(p.consents.marketing_email))
      }
    })
  }, [])

  const handleAgreeAll = (checked: boolean) => {
    setAgreeAll(checked)
    setAgreeAge(checked)
    setAgreeTerms(checked)
    setAgreePrivacy(checked)
    setAgreeMarketing(checked)
  }

  const duplicateNotice = (error: string, loginMethods?: string[]) => {
    alert(error)
    if (loginMethods?.length) setNotice(error)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pending) return
    if (!agreeAge || !agreeTerms || !agreePrivacy) {
      alert("필수 약관에 모두 동의해주세요.")
      return
    }
    if (!phoneState.ready) {
      alert(pending.verificationMode === "identity" ? "본인인증을 먼저 완료해주세요." : pending.verificationMode === "sms" ? "휴대폰 인증을 먼저 완료해주세요." : "휴대폰 번호를 확인해주세요.")
      return
    }
    const referralCode = pending.reverify ? null : normalizeReferralCode(referral)
    if (referralCode) {
      const checked = referralCheck?.input === referralCode ? referralCheck : await verifyReferral(referralCode)
      if (!checked?.valid) {
        alert("추천인 ID 를 찾을 수 없습니다. 다시 확인하거나 칸을 비워 주세요.")
        return
      }
    }
    setIsLoading(true)
    const r = await completeSignup({
      referralCode: referralCode || null,
      name: name.trim(),
      email: pending.email ? null : email.trim(),
      phone: pending.verificationMode === "identity" ? null : phoneState.phone,
      agreements: { age: agreeAge, terms: agreeTerms, privacy: agreePrivacy, marketing: agreeMarketing },
    })
    setIsLoading(false)
    if (!r.success) {
      duplicateNotice(r.error, r.loginMethods)
      return
    }
    forgetReferralCode()
    localStorage.setItem("dukji_user", JSON.stringify(r.user))
    userService.registerOrUpdateUser(r.user)
    trackSignup()
    loadPoints() // 가입 전엔 비회원으로 불러 둔 잔액이라 새로 불러옴
    router.push("/")
  }

  const handleCancel = async () => {
    await cancelSignup()
    router.push("/login/")
  }

  return (
    <AuthShell wide>
      <AuthTitle
        title={pending?.reverify ? "본인인증" : "회원가입"}
        sub={
          pending?.reverify
            ? "본인인증이 필요해요. 한 번만 인증하면 계속 이용할 수 있어요."
            : pending
              ? `${PROVIDER_LABEL[pending.provider] || ""} 계정 확인을 마쳤어요. 본인인증과 남은 정보를 입력해 주세요.`
              : undefined
        }
      />
      {pending && !pending.reverify && (pending.provider === "cognito" || pending.provider === "email") && <StepBar steps={SIGNUP_STEPS} current={3} />}
        {pending === undefined ? (
          <p className="text-center text-xs text-zinc-400 py-6">불러오는 중...</p>
        ) : pending === null ? (
          <div className="text-center space-y-4 py-6">
            <p className="text-xs text-zinc-400">가입 시간이 지났거나 로그인 정보가 없습니다. 다시 로그인해주세요.</p>
            <Button
              onClick={() => router.push("/login/")}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold py-3 rounded-2xl text-xs"
            >
              로그인 화면으로
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {notice && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                {notice}{" "}
                <button type="button" onClick={handleCancel} className="underline font-bold">
                  로그인 화면으로
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm text-zinc-200 font-bold mb-2">닉네임 (필수)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={20}
                  placeholder="성지탐험가"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={signupInput}
                />
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-4" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-200 font-bold mb-2">이메일 주소 (필수)</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  disabled={Boolean(pending.email)}
                  placeholder="dukji@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={signupInput}
                />
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-4" />
              </div>
            </div>

            <PhoneVerification
              info={pending}
              scope="signup"
              initialPhone={pending.phone || ""}
              onChange={setPhoneState}
              onDuplicate={(error) => setNotice(error)}
              large
            />

            {!pending.reverify && (
            <div>
              <label htmlFor="signup-referral" className="block text-sm text-zinc-200 font-bold mb-2">
                추천인 ID (선택)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="signup-referral"
                    type="text"
                    maxLength={12}
                    autoCapitalize="characters"
                    placeholder="예: DJ7K2P9Q"
                    value={referral}
                    onChange={(e) => {
                      setReferral(e.target.value.toUpperCase())
                      setReferralCheck(null)
                    }}
                    className={`${signupInput} uppercase tracking-wider`}
                  />
                  <Gift className="w-4 h-4 text-zinc-500 absolute left-3.5 top-4" />
                </div>
                <button
                  type="button"
                  onClick={() => verifyReferral(referral)}
                  disabled={!referral.trim() || referralChecking}
                  className="shrink-0 px-4 rounded-lg bg-zinc-800 text-sm hover:bg-zinc-700 text-xs font-bold text-white disabled:opacity-40"
                >
                  {referralChecking ? "확인 중" : "확인"}
                </button>
              </div>
              <p className={`mt-1.5 text-xs ${referralCheck ? (referralCheck.valid ? "text-emerald-400" : "text-red-400") : "text-zinc-500"}`}>
                {referralCheck
                  ? referralCheck.valid
                    ? `${referralCheck.name} 님의 추천 ID 예요. 가입하면 50 DP 를 받아요.`
                    : referralCheck.error
                  : "친구에게 받은 추천 ID 를 적으면 가입할 때 50 DP, 친구는 150 DP 를 받아요."}
              </p>
            </div>
            )}

            <div className="space-y-3 pt-4 border-t border-zinc-800/80 text-sm">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-white">
                <input
                  type="checkbox"
                  checked={agreeAll}
                  onChange={(e) => handleAgreeAll(e.target.checked)}
                  className="w-5 h-5 accent-red-600"
                />
                <span>전체 동의하기</span>
              </label>

              <div className="pl-1 space-y-3 text-zinc-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeAge}
                    onChange={(e) => setAgreeAge(e.target.checked)}
                    className="w-5 h-5 accent-red-600"
                  />
                  <span>[필수] 만 14세 이상입니다</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="w-5 h-5 accent-red-600"
                  />
                  <span>[필수] 서비스 이용약관 동의</span>
                  <a href="/terms/" target="_blank" rel="noopener noreferrer" className="ml-auto text-zinc-500 underline hover:text-white">보기</a>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                    className="w-5 h-5 accent-red-600"
                  />
                  <span>[필수] 개인정보 수집 및 이용 동의</span>
                  <a href="/privacy/" target="_blank" rel="noopener noreferrer" className="ml-auto text-zinc-500 underline hover:text-white">보기</a>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeMarketing}
                    onChange={(e) => setAgreeMarketing(e.target.checked)}
                    className="w-5 h-5 accent-red-600"
                  />
                  <span>[선택] 신규 팝업 오픈 알림 및 마케팅 수신 동의</span>
                </label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-base transition-all mt-4 flex items-center justify-center gap-1.5"
            >
              {isLoading ? (
                <span>처리 중...</span>
              ) : (
                <>
                  <span>{pending.reverify ? "인증 완료하고 계속하기" : "동의하고 가입하기"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </form>
        )}

        <div className="mt-8 flex items-center justify-between text-sm text-zinc-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            개인정보는 암호화해 보관해요.
          </span>
          <button type="button" onClick={handleCancel} className="hover:text-white underline">
            가입 취소
          </button>
        </div>
    </AuthShell>
  )
}
