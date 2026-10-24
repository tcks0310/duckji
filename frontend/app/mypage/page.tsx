"use client"

import * as React from "react"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BadgeCheck, Mail, User, ShieldCheck, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loginWithKakao } from "@/lib/kakao-auth"
import { loginWithNaver } from "@/lib/naver-auth"
import { loginWithGoogle } from "@/lib/google-auth"
import { isAppleLoginEnabled, loginWithApple } from "@/lib/apple-auth"
import {
  changeMyPhone,
  endLink,
  getMyVerification,
  logoutMember,
  startLink,
  unlinkProvider,
  updateMyConsents,
  updateMyProfile,
  withdrawMember,
  type MyInfo,
  type VerificationInfo,
} from "@/lib/member-auth"
import { inputClass as baseInputClass, PhoneVerification, type PhoneState } from "@/components/auth/phone-verification"
import { PointHistoryPanel } from "@/components/points/point-history-panel"
import { AlertsPanel, FundingPanel } from "@/components/mypage/saved-panels"
import { ReservationsPanel } from "@/components/mypage/reservations-panel"
import { InvitePanel } from "@/components/mypage/invite-panel"
import { OrdersPanel } from "@/components/mypage/orders-panel"
import { AddressesPanel } from "@/components/mypage/addresses-panel"
import { NotificationsPanel } from "@/components/mypage/notifications-panel"
import { MyPageShell, useMyPage, type MyPageSection } from "@/components/mypage/mypage-shell"
import { usePhoneLayout } from "@/lib/app-mode"
import { uploadImageFile } from "@/lib/image-upload"
import { dropHighlight, useImageDrop } from "@/lib/use-image-drop"
import { DatePicker, todayYmd } from "@/components/ui/date-picker"

// 마이페이지 (/mypage/?tab=...): 예약·웨이팅, 알림 신청, 내 펀딩, 주문 내역, 포인트 관리, 친구 초대, 회원 정보 수정, 배송지 관리, 로그인 연동, 알림 설정, 수신 동의·탈퇴
// 찜한 항목은 /mypage/liked 페이지. 메뉴 목록은 components/mypage/mypage-shell.tsx
// 장바구니(/store/goods/cart)는 펀딩·스토어 정리 때까지 마이페이지 메뉴에서 뺌 (예전 ?tab=cart 주소만 그 페이지로 보냄)

const SECTIONS: Partial<Record<MyPageSection, { title: string; description?: string }>> = {
  notifications: { title: "알림 설정", description: "받을 알림을 골라요. 받은 알림은 상단 종 아이콘이나 알림 페이지에서 봐요." },
  tickets: { title: "예약·웨이팅", description: "덕지에서 직접 운영하는 팝업의 사전 예약과 현장 웨이팅이에요." },
  alerts: { title: "알림 신청", description: "오픈·티켓팅 알림을 신청한 팝업이에요." },
  funding: { title: "내 펀딩", description: "참여한 펀딩과 직접 연 펀딩이에요." },
  orders: { title: "주문 내역", description: "굿즈샵에서 덕지 포인트(DP)로 주문한 내역이에요. 발송 전에는 직접 취소할 수 있어요." },
  points: { title: "포인트 관리", description: "DP 를 충전하거나 프로모션 코드로 적립하고, 덕지 포인트(DP)를 어디서 받고 썼는지 볼 수 있어요." },
  invite: { title: "친구 초대", description: "내 고유 추천 ID 와 추천 링크·QR 이에요." },
  info: { title: "회원 정보 수정" },
  address: { title: "배송지 관리", description: "굿즈를 받을 주소예요. 주문할 때 기본 배송지가 자동으로 채워져요." },
  links: { title: "로그인 연동", description: "연동한 계정 중 어느 것으로 로그인해도 같은 덕지 계정으로 들어와요." },
  settings: { title: "수신 동의·탈퇴" },
  home: { title: "마이" },
  app: { title: "앱 설정" },
}

// 예전 주소(?tab=saved, ?tab=cart)는 새 페이지로
const MOVED: Record<string, string> = { saved: "/mypage/liked/", cart: "/store/goods/cart/" }

// 프로필 사진 기본 이미지 (서버는 이 경로와 직접 올린 사진 주소만 받음)
const AVATAR_PRESETS = [
  { label: "덕지 마스코트", url: "/images/avatar/female.jpg" },
  { label: "검술사", url: "/images/avatar/male.jpg" },
  { label: "루나", url: "/images/npc/luna.jpg" },
  { label: "아카샤", url: "/images/npc/akasha.jpg" },
  { label: "아쿠아리아", url: "/images/npc/aquaria.jpg" },
  { label: "헤파이", url: "/images/npc/hepai.jpg" },
]

const PROVIDERS = [
  { id: "kakao", label: "카카오", className: "bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919]" },
  { id: "naver", label: "네이버", className: "bg-[#03C75A] hover:bg-[#02B350] text-white" },
  { id: "google", label: "Google", className: "bg-zinc-950 hover:bg-zinc-800 text-white border border-zinc-700" },
  // 애플: Services ID 가 설정됐을 때만
  ...(isAppleLoginEnabled() ? [{ id: "apple", label: "Apple", className: "bg-white hover:bg-zinc-200 text-black" } as const] : []),
  { id: "cognito", label: "이메일", className: "" },
] as const

const LOGIN = { kakao: loginWithKakao, naver: loginWithNaver, google: loginWithGoogle, apple: loginWithApple } as const

const fmtDate = (v: string) => new Date(v).toLocaleDateString("ko-KR")
const inputClass = baseInputClass.replace("text-xs", "text-sm").replace("rounded-xl", "rounded-lg")
const plainInput = inputClass.replace("pl-9", "pl-3")
// 계정 설정 화면 공통: 큰 박스 없이 '이름 | 내용' 줄을 얇은 선으로 나눔 (친구 초대 화면과 같은 모양)
const rows = "border-y border-zinc-800 divide-y divide-zinc-800"
const row = "py-5 grid gap-2 sm:grid-cols-[140px_1fr] sm:gap-6"
const rowLabel = "text-sm font-bold text-zinc-300 sm:pt-2.5"
const sectionTitle = "text-base font-bold text-white mb-3"
const primaryBtn = "h-11 px-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm transition-colors"
const lineBtn = "h-10 px-4 rounded-lg border border-zinc-700 bg-transparent text-sm text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-transparent"

export default function MyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <MyPageContent />
    </Suspense>
  )
}

function MyPageContent() {
  const params = useSearchParams()
  // 알림톡 템플릿 버튼에 등록한 ?tab=reservations 는 예약·웨이팅으로
  const wanted = params.get("tab") === "reservations" ? "tickets" : params.get("tab") || ""
  // 휴대폰 화면(앱·모바일 웹)의 마이(/mypage/)는 앱 마이 첫 화면, 넓은 화면은 예약·웨이팅부터
  const isApp = usePhoneLayout()
  const tab: MyPageSection = wanted in SECTIONS ? (wanted as MyPageSection) : isApp ? "home" : "tickets"

  useEffect(() => {
    if (MOVED[wanted]) window.location.replace(MOVED[wanted])
  }, [wanted])

  const section = SECTIONS[tab]!
  return (
    <MyPageShell active={tab} title={section.title} description={section.description}>
      <SectionBody tab={tab} />
    </MyPageShell>
  )
}

function SectionBody({ tab }: { tab: MyPageSection }) {
  const router = useRouter()
  const { info, setInfo, reload } = useMyPage()
  const [isLoading, setIsLoading] = useState(false)
  const common = { info, isLoading, setIsLoading }

  switch (tab) {
    case "notifications":
      return <NotificationsPanel />
    case "tickets":
      return <ReservationsPanel />
    case "alerts":
      return <AlertsPanel />
    case "funding":
      return <FundingPanel />
    case "orders":
      return <OrdersPanel />
    case "points":
      return <PointHistoryPanel onRequireLogin={() => router.push("/login/")} />
    case "invite":
      return <InvitePanel />
    case "info":
      return <InfoTab {...common} onSaved={setInfo} />
    case "address":
      return <AddressesPanel info={info} reload={reload} />
    case "links":
      return <LinksTab {...common} onChanged={setInfo} reload={reload} />
    case "settings":
      return <SettingsTab {...common} reload={reload} />
    default:
      return null
  }
}

interface TabProps {
  info: MyInfo
  isLoading: boolean
  setIsLoading: (v: boolean) => void
}

function InfoTab({ info, onSaved, isLoading, setIsLoading }: TabProps & { onSaved: (i: MyInfo) => void }) {
  const locked = info.identityVerified // 본인인증한 이름·생년월일·성별은 고정
  const [name, setName] = useState(info.user.name)
  const [realName, setRealName] = useState(info.profile.realName || "")
  const [birthDate, setBirthDate] = useState(info.profile.birthDate || "")
  const [gender, setGender] = useState(info.profile.gender || "")
  const [region, setRegion] = useState(info.profile.region || "")
  const [bio, setBio] = useState(info.profile.bio || "")
  const [avatarUrl, setAvatarUrl] = useState(info.user.avatarUrl || AVATAR_PRESETS[0].url)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // 프로필 사진 직접 올리기 (게시판 업로드 주소 사용). 저장 버튼을 눌러야 회원 정보에 반영
  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return
    setAvatarUploading(true)
    try {
      setAvatarUrl(await uploadImageFile("community", file))
    } catch (err: any) {
      alert(err?.message || "사진을 올리지 못했습니다.")
    } finally {
      setAvatarUploading(false)
    }
  }
  const avatarDrop = useImageDrop((files) => handleAvatarFile(files[0]), avatarUploading)
  const [changingPhone, setChangingPhone] = useState(false)
  const [verification, setVerification] = useState<VerificationInfo | null>(null)
  const [phoneState, setPhoneState] = useState<PhoneState>({ phone: "", ready: false })

  // 모바일 본인인증에서 돌아온 경우 번호 변경 칸을 바로 열어 둠
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("identityVerificationId")) openPhoneChange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openPhoneChange = async () => {
    const v = await getMyVerification()
    if (!v) {
      alert("잠시 후 다시 시도해주세요.")
      return
    }
    setVerification(v)
    setChangingPhone(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const r = await updateMyProfile({
      name: name.trim(),
      ...(avatarUrl !== info.user.avatarUrl ? { avatarUrl } : {}),
      ...(locked ? {} : { realName: realName.trim() || null, birthDate: birthDate || null, gender: (gender || null) as MyInfo["profile"]["gender"] }),
      region: region.trim() || null,
      bio: bio.trim() || null,
    })
    setIsLoading(false)
    if (!r.success) {
      alert(r.error)
      return
    }
    onSaved(r.info)
    try {
      const saved = JSON.parse(localStorage.getItem("dukji_user") || "null")
      if (saved) localStorage.setItem("dukji_user", JSON.stringify({ ...saved, name: r.info.user.name, avatarUrl: r.info.user.avatarUrl }))
    } catch {
      // 화면 표시용 캐시라 실패해도 무시
    }
    alert("저장했습니다.")
  }

  const handlePhone = async () => {
    if (!verification || !phoneState.ready) {
      alert(verification?.verificationMode === "identity" ? "본인인증을 먼저 완료해주세요." : "휴대폰 인증을 먼저 완료해주세요.")
      return
    }
    setIsLoading(true)
    const r = await changeMyPhone(verification.verificationMode === "identity" ? null : phoneState.phone)
    setIsLoading(false)
    if (!r.success) {
      alert(r.error)
      return
    }
    onSaved(r.info)
    setChangingPhone(false)
    alert("휴대폰 번호를 바꿨습니다.")
  }

  return (
    <form onSubmit={handleSave} className="max-w-3xl">
      <div className={`${rows} border-t-0 -mt-5`}>
        <div className={row}>
          <div className={rowLabel}>프로필 사진</div>
          <div {...avatarDrop.dropProps} className={`flex items-center gap-4 ${avatarDrop.dragging ? dropHighlight : ""}`}>
            <img src={avatarUrl} alt="프로필 사진" className="w-20 h-20 rounded-full object-cover shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_PRESETS.map((p) => (
                  <button
                    key={p.url}
                    type="button"
                    title={p.label}
                    onClick={() => setAvatarUrl(p.url)}
                    className={`w-9 h-9 rounded-full overflow-hidden ring-2 ring-offset-2 ring-offset-zinc-950 ${avatarUrl === p.url ? "ring-white" : "ring-transparent"}`}
                  >
                    <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <label className="inline-block text-sm text-zinc-400 hover:text-white cursor-pointer underline">
                {avatarUploading ? "올리는 중..." : "직접 올리기 (끌어다 놓아도 됨)"}
                <input type="file" accept="image/*" className="hidden" disabled={avatarUploading} onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
              </label>
            </div>
          </div>
        </div>

        <div className={row}>
          <label className={rowLabel}>닉네임</label>
          <div className="relative max-w-md">
            <input type="text" required minLength={2} maxLength={20} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          </div>
        </div>

        <div className={row}>
          <div className={rowLabel}>이메일</div>
          <div className="text-sm text-zinc-300 sm:pt-2.5 flex items-center gap-2">
            <Mail className="w-4 h-4 text-zinc-500" />
            {info.user.email}
          </div>
        </div>

        <div className={row}>
          <div className={rowLabel}>휴대폰 번호</div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 sm:pt-1">
              <span className="text-sm text-zinc-300 flex items-center gap-2">
                {info.identityVerified ? <BadgeCheck className="w-4 h-4 text-emerald-400" /> : <ShieldCheck className="w-4 h-4 text-zinc-500" />}
                {info.profile.phone || "등록된 번호 없음"}
              </span>
              {(info.identityVerified || info.phoneVerified) && (
                <span className="text-xs text-zinc-500">{info.identityVerified ? "본인인증 완료" : "인증 완료"}</span>
              )}
              {!changingPhone && (
                <Button type="button" variant="outline" onClick={openPhoneChange} className={`${lineBtn} h-9`}>
                  번호 변경
                </Button>
              )}
            </div>
            {changingPhone && verification && (
              <div className="max-w-md space-y-3 pt-1">
                <PhoneVerification info={verification} scope="me" label="새 휴대폰 번호" onChange={setPhoneState} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setChangingPhone(false)} className={`${lineBtn} flex-1`}>
                    취소
                  </Button>
                  <Button type="button" disabled={isLoading} onClick={handlePhone} className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg">
                    변경하기
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={row}>
          <label className={rowLabel}>이름</label>
          <div className="max-w-md">
            <input type="text" maxLength={30} disabled={locked} value={realName} onChange={(e) => setRealName(e.target.value)} className={plainInput} />
            {locked && <p className="mt-1.5 text-xs text-zinc-500">본인인증한 이름은 바꿀 수 없어요.</p>}
          </div>
        </div>

        <div className={row}>
          <label className={rowLabel}>생년월일</label>
          <div className="max-w-md">
            <DatePicker disabled={locked} value={birthDate} max={todayYmd()} defaultMonth="2000-01" onChange={setBirthDate} className={plainInput} placeholder="생년월일 선택" aria-label="생년월일" />
          </div>
        </div>

        <div className={row}>
          <label className={rowLabel}>성별</label>
          <div className="max-w-md">
            <select disabled={locked} value={gender} onChange={(e) => setGender(e.target.value)} className={plainInput}>
              <option value="">선택 안 함</option>
              <option value="female">여성</option>
              <option value="male">남성</option>
              <option value="other">기타</option>
            </select>
          </div>
        </div>

        <div className={row}>
          <label className={rowLabel}>지역</label>
          <div className="relative max-w-md">
            <input type="text" maxLength={50} placeholder="서울 마포구" value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass} />
            <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          </div>
        </div>

        <div className={row}>
          <label className={rowLabel}>소개</label>
          <textarea maxLength={300} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className={`${plainInput} resize-none`} />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-zinc-500">가입일 {fmtDate(info.user.joinedAt)}</p>
        <Button type="submit" disabled={isLoading} className={`${primaryBtn} w-full sm:w-auto`}>
          {isLoading ? "처리 중..." : "저장하기"}
        </Button>
      </div>
    </form>
  )
}

function LinksTab({ info, onChanged, reload, isLoading, setIsLoading }: TabProps & { onChanged: (i: MyInfo) => void; reload: () => Promise<void> }) {
  const linked = new Map(info.loginMethods.map((m) => [m.provider === "email" ? "cognito" : m.provider, m]))

  const handleLink = async (provider: keyof typeof LOGIN) => {
    setIsLoading(true)
    const started = await startLink()
    if (!started.success) {
      setIsLoading(false)
      alert(started.error)
      return
    }
    try {
      await LOGIN[provider]()
      alert("연동했습니다. 이제 이 계정으로도 로그인할 수 있습니다.")
    } catch (err: any) {
      const msg = err?.message || err?.error_description || ""
      if (msg && !/닫혔|closed|cancel/i.test(msg)) alert(msg)
    } finally {
      await endLink()
      await reload()
      setIsLoading(false)
    }
  }

  const handleUnlink = async (provider: string, label: string) => {
    if (!window.confirm(`${label} 연동을 해제할까요? 해제하면 ${label}(으)로는 로그인할 수 없습니다.`)) return
    setIsLoading(true)
    const r = await unlinkProvider(provider)
    setIsLoading(false)
    if (!r.success) {
      alert(r.error)
      return
    }
    onChanged(r.info)
  }

  return (
    <div className={`${rows} border-t-0 -mt-2 max-w-3xl`}>
      {PROVIDERS.map((p) => {
        const m = linked.get(p.id)
        return (
          <div key={p.id} className="flex items-center gap-3 py-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">{p.label}</div>
              <div className="mt-0.5 text-sm text-zinc-500 truncate">
                {m ? `${m.email || "연결됨"} · ${fmtDate(m.linkedAt)} 연결` : "연결 안 됨"}
              </div>
            </div>
            {m ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading}
                onClick={() => handleUnlink(m.provider, p.label)}
                className="text-sm text-zinc-400 hover:text-red-400 hover:bg-transparent h-9 px-3"
              >
                해제
              </Button>
            ) : p.id === "cognito" ? (
              <span className="text-sm text-zinc-500">이메일 가입 회원만</span>
            ) : (
              <button
                disabled={isLoading}
                onClick={() => handleLink(p.id as keyof typeof LOGIN)}
                className={`px-4 h-9 rounded-lg font-bold text-sm transition-colors cursor-pointer disabled:opacity-60 ${p.className}`}
              >
                연결
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SettingsTab({ info, reload, isLoading, setIsLoading }: TabProps & { reload: () => Promise<void> }) {
  const router = useRouter()
  const agreed = (k: string) => Boolean(info.consents[k]?.agreed)
  const usesEmail = info.loginMethods.some((m) => m.provider === "cognito")
  const [reason, setReason] = useState("")
  const [password, setPassword] = useState("")

  const toggle = async (k: string, v: boolean) => {
    setIsLoading(true)
    const r = await updateMyConsents({ [k]: v })
    setIsLoading(false)
    if (!r.success) alert(r.error)
    await reload()
  }

  const handleWithdraw = async () => {
    if (!window.confirm("정말 탈퇴할까요? 회원 정보는 바로 지워지고 되돌릴 수 없습니다. 탈퇴 후 30일 동안은 같은 이메일·휴대폰 번호로 다시 가입할 수 없습니다.")) return
    setIsLoading(true)
    const r = await withdrawMember({ reason: reason.trim() || undefined, ...(usesEmail && password ? { email: info.user.email, password } : {}) })
    setIsLoading(false)
    if (!r.success) {
      alert(r.error)
      return
    }
    await logoutMember()
    localStorage.removeItem("dukji_user")
    alert("탈퇴했습니다. 그동안 이용해주셔서 감사합니다.")
    router.push("/")
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <section>
        <h3 className={sectionTitle}>수신 동의</h3>
        <div className={rows}>
          {[
            { k: "marketing_email", label: "이메일", desc: "신규 팝업 오픈·이벤트 소식" },
            { k: "marketing_sms", label: "문자·알림톡", desc: "신규 팝업 오픈·이벤트 소식" },
          ].map(({ k, label, desc }) => (
            <label key={k} className="py-4 flex items-center justify-between gap-4 cursor-pointer">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white">{label}</span>
                <span className="block mt-0.5 text-sm text-zinc-400">{desc}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0 text-sm text-zinc-400">
                {agreed(k) ? "받음" : "받지 않음"}
                <input
                  type="checkbox"
                  disabled={isLoading}
                  checked={agreed(k)}
                  onChange={(e) => toggle(k, e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 text-red-500 focus:ring-red-500"
                />
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className={sectionTitle}>회원 탈퇴</h3>
        <div className="border-t border-zinc-800 pt-4 space-y-3">
          <p className="text-sm text-zinc-400 leading-relaxed">탈퇴하면 회원 정보는 바로 지워지고, 법으로 보관해야 하는 기록만 정해진 기간 동안 따로 보관합니다. 탈퇴 후 30일 동안은 같은 이메일·휴대폰 번호·본인인증으로 다시 가입할 수 없습니다.</p>
          <div className="max-w-md space-y-2">
            <input type="text" maxLength={300} placeholder="탈퇴 사유 (선택)" value={reason} onChange={(e) => setReason(e.target.value)} className={plainInput} />
            {usesEmail && (
              <input
                type="password"
                placeholder="이메일 로그인 비밀번호 (이메일 계정도 함께 삭제)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={plainInput}
              />
            )}
          </div>
          <Button variant="outline" disabled={isLoading} onClick={handleWithdraw} className={`${lineBtn} text-red-400 hover:text-red-300`}>
            탈퇴하기
          </Button>
        </div>
      </section>
    </div>
  )
}
