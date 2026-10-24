"use client"

import Link from "next/link"
import { Footer } from "@/components/footer"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { SajuEmulator } from "@/components/saju-ai/saju-emulator"
import { SAJU_DAILY } from "@/lib/saju-ai"

// 덕지 도사 AI 사주 페이지: 왼쪽 에뮬레이터 + 오른쪽(모바일은 아래) 이용 안내
export function SajuAiPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <SubPageHeader groupId="play" itemId="saju-ai" />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-8 lg:gap-10 items-start">
          <SajuEmulator />
          <Guide />
        </div>
      </main>
      <Footer />
    </div>
  )
}

const STEPS = [
  { title: "생년월일 넣기", body: "양력·음력과 태어난 시각을 넣어요. 시각을 몰라도 볼 수 있어요." },
  { title: "사주 원국 펼치기", body: "만세력으로 여덟 글자와 오행을 계산해 보여 줘요." },
  { title: "운세 고르기", body: "날마다 바뀌는 오늘의 운세나 성격·이성·재물 같은 타고난 사주를 골라요." },
  { title: "직접 물어보기", body: "풀이를 보고 궁금한 건 덕지 도사에게 바로 물어봐요." },
]

function Guide() {
  return (
    <aside className="space-y-8 lg:sticky lg:top-28">
      <div className="space-y-2">
        <p className="text-sm text-violet-300">운세·놀이</p>
        <h1 className="text-2xl font-bold text-white">덕지 도사 AI 사주</h1>
        <p className="text-sm text-zinc-400 leading-relaxed break-keep">명리 고서를 정주행한 덕순이가 만세력으로 사주를 세우고 쉬운 말로 풀어 줘요. 로그인한 회원만 볼 수 있어요.</p>
      </div>

      <ol className="space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="w-6 h-6 shrink-0 rounded-full bg-violet-400/15 text-violet-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-white">{s.title}</p>
              <p className="text-xs text-zinc-400 leading-relaxed break-keep">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="space-y-2.5 border-t border-zinc-800 pt-6">
        <p className="text-sm font-semibold text-white">오늘의 운세 {SAJU_DAILY.length}가지</p>
        <div className="flex flex-wrap gap-1.5">
          {SAJU_DAILY.map((t) => (
            <span key={t.id} className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
              {t.icon} {t.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="space-y-1.5 border-t border-zinc-800 pt-6 text-xs text-zinc-500 leading-relaxed">
        <li>· 도사가 새로 풀이하거나 답할 때마다 100 DP 가 들어요(덕지 앱에서는 하루 10번 무료). 이미 본 풀이는 다시 봐도 DP 를 쓰지 않아요.</li>
        <li>· 답을 받지 못하면 쓴 DP 는 바로 돌려드려요.</li>
        <li>· 재미로 보는 풀이예요. 중요한 결정의 근거로 쓰지 마세요.</li>
      </ul>

      <Link href="/play/" className="inline-block text-sm text-zinc-400 hover:text-white">
        ← 다른 놀이 보기
      </Link>
    </aside>
  )
}
