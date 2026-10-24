import { REASONS, TAROT_DAILY_DP, type TarotDailyType } from "./rules"
import { earnMemberPoints, RewardError } from "./shared-tables"
import { seoulDay, tx } from "./tx"

// 오늘의 타로 도장 (운세·놀이 › 타로·주사위). 카드 뽑기는 화면에서 하고, 서버는 종류마다 하루 한 번만 DP 를 줌
// 금액은 rules.ts 에서 정하고 화면이 보내는 금액은 쓰지 않음. 원장 refId = "<종류>:<한국 날짜>"

const isType = (v: unknown): v is TarotDailyType => typeof v === "string" && Object.hasOwn(TAROT_DAILY_DP, v)

export async function claimTarotDaily(memberId: string, type: unknown) {
  if (!isType(type)) throw new RewardError(400, "잘못된 요청입니다.")
  const amount = TAROT_DAILY_DP[type]
  const balance = await tx((client) => earnMemberPoints(client, memberId, amount, REASONS.tarotDaily, `${type}:${seoulDay()}`))
  return { type, rewardDp: amount, balance }
}
