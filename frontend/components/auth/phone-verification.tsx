"use client"

import { useEffect, useState } from "react"
import { Phone, KeyRound, BadgeCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  confirmIdentity,
  IDENTITY_RETURN_PARAM,
  requestIdentity,
  sendPhoneCode,
  verifyPhoneCode,
  type VerificationInfo,
  type VerifiedIdentity,
  type VerifyScope,
} from "@/lib/member-auth"

// 휴대폰 확인 칸 (회원가입·마이페이지 번호 변경 공용). 서버 설정에 따라
//   identity: [본인인증 하기] 버튼 → 포트원 창, 끝나면 이름·가린 번호 표시
//   sms     : 번호 입력 + 인증번호 받기·확인
//   none    : 번호 입력만 (중복 확인은 서버가 가입 때)
// 화면은 로그인·가입 페이지 입력칸 스타일을 그대로 씀

export const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 disabled:text-zinc-400"

export interface PhoneState {
  phone: string // sms·none 일 때 입력한 번호
  ready: boolean // 제출해도 되는지 (본인인증 완료, 문자 인증 완료, 또는 번호 형식 맞음)
}

interface Props {
  info: VerificationInfo
  scope: VerifyScope
  initialPhone?: string
  label?: string
  onChange: (state: PhoneState) => void
  onDuplicate?: (error: string, loginMethods?: string[]) => void
  large?: boolean // 회원가입 페이지(큰 입력칸)
}

const MOBILE_RE = /^01[016789]\d{7,8}$/

export function PhoneVerification({ info, scope, initialPhone = "", label = "휴대폰 번호 (필수)", onChange, onDuplicate, large = false }: Props) {
  const mode = info.verificationMode
  const [phone, setPhone] = useState(initialPhone)
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [identity, setIdentity] = useState<VerifiedIdentity | null>(info.identity)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (mode === "identity") onChange({ phone: "", ready: Boolean(identity) })
    else if (mode === "sms") onChange({ phone, ready: phoneVerified })
    else onChange({ phone, ready: MOBILE_RE.test(phone) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phone, phoneVerified, identity])

  // 모바일: 포트원 페이지에서 돌아오면 주소의 identityVerificationId 로 결과 확인
  useEffect(() => {
    if (mode !== "identity") return
    const params = new URLSearchParams(window.location.search)
    const id = params.get(IDENTITY_RETURN_PARAM)
    if (!id) return
    params.delete(IDENTITY_RETURN_PARAM)
    params.delete("code")
    params.delete("message")
    const rest = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`)
    setIsLoading(true)
    confirmIdentity(id).then((r) => {
      setIsLoading(false)
      if (r.success) setIdentity(r.identity)
      else alert(r.error)
    })
  }, [mode])

  const handleIdentity = async () => {
    if (!info.portone) return
    setIsLoading(true)
    try {
      const r = await requestIdentity(info.portone)
      if (r.success) setIdentity(r.identity)
      else alert(r.error)
    } catch (e: any) {
      alert(e?.message || "본인인증을 진행하지 못했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const onPhoneChange = (v: string) => {
    setPhone(v.replace(/[^\d]/g, "").slice(0, 11))
    // 번호를 바꾸면 인증을 다시 받아야 함
    setCodeSent(false)
    setPhoneVerified(false)
    setCode("")
  }

  const handleSendCode = async () => {
    if (!MOBILE_RE.test(phone)) {
      alert("휴대폰 번호를 확인해주세요.")
      return
    }
    setIsLoading(true)
    const r = await sendPhoneCode(phone, scope)
    setIsLoading(false)
    if (!r.success) {
      alert(r.error)
      return
    }
    setCodeSent(true)
    if (r.devCode) setCode(r.devCode) // 로컬 개발에서만 내려옴
    alert("인증번호를 보냈습니다. 문자를 확인해주세요.")
  }

  const handleVerifyCode = async () => {
    setIsLoading(true)
    const r = await verifyPhoneCode(phone, code.trim(), scope)
    setIsLoading(false)
    if (!r.success) {
      alert(r.error)
      if (r.loginMethods?.length) onDuplicate?.(r.error, r.loginMethods)
      return
    }
    setPhoneVerified(true)
  }

  if (mode === "identity") {
    return (
      <div>
        <label className={large ? "block text-sm text-zinc-200 font-bold mb-2" : "block text-[11px] text-zinc-400 font-bold mb-1"}>본인인증 (필수)</label>
        {identity ? (
          <div className={`flex items-center gap-2 bg-zinc-950 border border-emerald-500/40 text-white ${large ? "rounded-lg px-4 h-12 text-sm" : "rounded-xl px-3 py-2.5 text-xs"}`}>
            <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">{identity.name}</span>
            <span className="text-zinc-400">{identity.phone}</span>
            {identity.birthDate && <span className="text-zinc-500">{identity.birthDate}</span>}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={isLoading || !info.portone}
            onClick={handleIdentity}
            className={large ? "w-full h-12 rounded-lg border-zinc-600 text-white text-sm font-bold" : "w-full rounded-xl border-zinc-700 text-zinc-300 text-xs"}
          >
            {isLoading ? "확인 중..." : "휴대폰 본인인증 하기"}
          </Button>
        )}
        <p className={large ? "text-xs text-zinc-500 mt-1.5" : "text-[10px] text-zinc-500 mt-1"}>본인 명의 휴대폰으로 인증하며, 한 사람당 한 계정만 가입할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <>
      <div>
        <label className="block text-[11px] text-zinc-400 font-bold mb-1">{label}</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="tel"
              required
              inputMode="numeric"
              placeholder="01012345678"
              value={phone}
              disabled={phoneVerified}
              onChange={(e) => onPhoneChange(e.target.value)}
              className={inputClass}
            />
            <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          </div>
          {mode === "sms" && (
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || phoneVerified}
              onClick={handleSendCode}
              className="rounded-xl border-zinc-700 text-zinc-300 text-xs"
            >
              {phoneVerified ? "인증 완료" : codeSent ? "다시 받기" : "인증번호 받기"}
            </Button>
          )}
        </div>
        {mode === "none" && <p className="text-[10px] text-zinc-500 mt-1">같은 번호로는 한 계정만 가입할 수 있습니다.</p>}
      </div>

      {mode === "sms" && codeSent && !phoneVerified && (
        <div>
          <label className="block text-[11px] text-zinc-400 font-bold mb-1">인증번호</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6자리 숫자"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
                className={inputClass}
              />
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || code.length !== 6}
              onClick={handleVerifyCode}
              className="rounded-xl border-zinc-700 text-zinc-300 text-xs"
            >
              확인
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
