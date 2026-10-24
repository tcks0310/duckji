import type { PoolClient } from "pg"
import { db } from "../../shared/db/require-database"
import { QUIZ_MAX_ITEMS, QUIZ_MAX_OPTIONS, REASONS } from "./rules"
import { earnMemberPoints, RewardError } from "./shared-tables"
import { tx } from "./tx"

// 덕력 퀴즈: 주제(quiz_topics) → 버전(quiz_versions, 한 회차) → 문제(quiz_items) → 보기(quiz_item_options)
// 정답은 서버에만 두고 서버가 채점. 회원은 버전마다 처음 푼 결과로 한 번 보상 (끝까지 풀면 base_dp + 정답마다 per_correct_dp)
// 사이트에는 공개(published)한 버전의, 보기 2개 이상·정답 하나가 정해진 문제만 나감

type Q = Pick<PoolClient, "query">

type VersionRow = {
  id: string
  topic_id: string
  title: string
  description: string
  base_dp: number
  per_correct_dp: number
  published: boolean
  sort_order: number
  created_at: Date
  updated_at: Date
}
type ItemRow = { id: string; version_id: string; question: string; explanation: string; sort_order: number }
type OptionRow = { id: string; item_id: string; label: string; is_answer: boolean; sort_order: number }

type FullItem = { id: number; question: string; explanation: string; sortOrder: number; options: { id: number; label: string; isAnswer: boolean }[] }

const itemReady = (it: FullItem) => it.options.length >= 2 && it.options.filter((o) => o.isAnswer).length === 1
export const rewardFor = (v: Pick<VersionRow, "base_dp" | "per_correct_dp">, correct: number) => v.base_dp + v.per_correct_dp * correct

// 버전들의 문제·보기 (순서대로)
async function itemsOf(q: Q, versionIds: number[]): Promise<Map<number, FullItem[]>> {
  const out = new Map<number, FullItem[]>(versionIds.map((id) => [id, []]))
  if (!versionIds.length) return out
  const { rows: items } = await q.query<ItemRow>(
    "SELECT * FROM rewards.quiz_items WHERE version_id = ANY($1) ORDER BY sort_order, id",
    [versionIds]
  )
  const { rows: options } = await q.query<OptionRow>(
    "SELECT o.* FROM rewards.quiz_item_options o JOIN rewards.quiz_items i ON i.id = o.item_id WHERE i.version_id = ANY($1) ORDER BY o.sort_order, o.id",
    [versionIds]
  )
  const byItem = new Map<string, FullItem["options"]>()
  for (const o of options) {
    const list = byItem.get(o.item_id) ?? []
    list.push({ id: Number(o.id), label: o.label, isAnswer: o.is_answer })
    byItem.set(o.item_id, list)
  }
  for (const it of items) {
    out.get(Number(it.version_id))?.push({
      id: Number(it.id),
      question: it.question,
      explanation: it.explanation,
      sortOrder: it.sort_order,
      options: byItem.get(it.id) ?? [],
    })
  }
  return out
}

async function publishedVersion(q: Q, id: number) {
  const { rows } = await q.query<VersionRow & { topic_title: string }>(
    "SELECT v.*, t.title AS topic_title FROM rewards.quiz_versions v JOIN rewards.quiz_topics t ON t.id = v.topic_id WHERE v.id = $1 AND v.published",
    [id]
  )
  if (!rows[0]) throw new RewardError(404, "공개된 퀴즈가 아닙니다.")
  const items = ((await itemsOf(q, [id])).get(id) ?? []).filter(itemReady)
  if (!items.length) throw new RewardError(404, "아직 문제가 준비되지 않았습니다.")
  return { version: rows[0], items }
}

type Attempt = { correct: number; total: number; rewardDp: number; createdAt: Date }
async function myAttempts(q: Q, memberId: string | null, versionIds: number[]) {
  const out = new Map<number, Attempt>()
  if (!memberId || !versionIds.length) return out
  const { rows } = await q.query<{ version_id: string; correct: number; total: number; reward_dp: number; created_at: Date }>(
    "SELECT version_id, correct, total, reward_dp, created_at FROM rewards.quiz_version_attempts WHERE member_id = $1 AND version_id = ANY($2)",
    [memberId, versionIds]
  )
  for (const r of rows) out.set(Number(r.version_id), { correct: r.correct, total: r.total, rewardDp: r.reward_dp, createdAt: r.created_at })
  return out
}

// ---- 사이트 ----

// 주제별 공개 버전 목록 (문제가 하나도 준비 안 된 버전·주제는 뺌)
export async function quizCatalog(memberId: string | null) {
  const q = db()
  const { rows: topics } = await q.query<{ id: string; title: string; description: string }>(
    "SELECT id, title, description FROM rewards.quiz_topics ORDER BY sort_order, id"
  )
  const { rows: versions } = await q.query<VersionRow>("SELECT * FROM rewards.quiz_versions WHERE published ORDER BY sort_order, id")
  const ids = versions.map((v) => Number(v.id))
  const items = await itemsOf(q, ids)
  const mine = await myAttempts(q, memberId, ids)
  return {
    topics: topics
      .map((t) => ({
        id: Number(t.id),
        title: t.title,
        description: t.description,
        versions: versions
          .filter((v) => v.topic_id === t.id)
          .map((v) => {
            const count = (items.get(Number(v.id)) ?? []).filter(itemReady).length
            return {
              id: Number(v.id),
              title: v.title,
              description: v.description,
              questionCount: count,
              maxRewardDp: rewardFor(v, count),
              mine: mine.get(Number(v.id)) ?? null,
            }
          })
          .filter((v) => v.questionCount > 0),
      }))
      .filter((t) => t.versions.length > 0),
  }
}

// 버전 하나 풀기 화면 (정답 없이)
export async function quizVersionForPlay(id: number, memberId: string | null) {
  const q = db()
  const { version, items } = await publishedVersion(q, id)
  const mine = await myAttempts(q, memberId, [id])
  return {
    version: {
      id,
      topicTitle: version.topic_title,
      title: version.title,
      description: version.description,
      baseDp: version.base_dp,
      perCorrectDp: version.per_correct_dp,
      maxRewardDp: rewardFor(version, items.length),
    },
    questions: items.map((it) => ({ id: it.id, question: it.question, options: it.options.map((o) => ({ id: o.id, label: o.label })) })),
    mine: mine.get(id) ?? null,
  }
}

function grade(items: FullItem[], answers: unknown) {
  if (!answers || typeof answers !== "object") throw new RewardError(400, "답을 모두 골라주세요.")
  const given = answers as Record<string, unknown>
  const results = items.map((it) => {
    const pick = Number(given[String(it.id)])
    if (!it.options.some((o) => o.id === pick)) throw new RewardError(400, "답을 모두 골라주세요.")
    const answer = it.options.find((o) => o.isAnswer)!.id
    return { id: it.id, picked: pick, answer, correct: pick === answer, explanation: it.explanation }
  })
  return { results, correct: results.filter((r) => r.correct).length, total: items.length }
}

// 채점. 회원: 처음이면 보상, 정답·해설을 보여 줌 / 비회원: 맞힌 개수만 (정답을 알아본 뒤 로그인해 보상받지 못하게)
export async function submitQuizVersion(id: number, memberId: string | null, answers: unknown) {
  if (!memberId) {
    const { items } = await publishedVersion(db(), id)
    const g = grade(items, answers)
    return { correct: g.correct, total: g.total, member: false as const }
  }
  return tx(async (client) => {
    const { version, items } = await publishedVersion(client, id)
    const g = grade(items, answers)
    const rewardDp = rewardFor(version, g.correct)
    const inserted = await client.query(
      "INSERT INTO rewards.quiz_version_attempts (member_id, version_id, correct, total, reward_dp) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
      [memberId, id, g.correct, g.total, rewardDp]
    )
    let earned = 0
    let balance: number | null = null
    if (inserted.rowCount) {
      if (rewardDp > 0) {
        balance = await earnMemberPoints(client, memberId, rewardDp, REASONS.quiz, `version:${id}`, `${version.topic_title} · ${version.title}`)
      }
      earned = rewardDp
    }
    const mine = (await myAttempts(client, memberId, [id])).get(id) ?? null
    return { ...g, member: true as const, earnedDp: earned, firstTry: Boolean(inserted.rowCount), balance, mine }
  })
}

// ---- 관리자 ----

const txt = (v: unknown, max: number, label: string, required: boolean) => {
  if (v === undefined) {
    if (required) throw new RewardError(400, `${label}을(를) 입력해주세요.`)
    return undefined
  }
  const s = typeof v === "string" ? v.trim() : ""
  if (required && !s) throw new RewardError(400, `${label}을(를) 입력해주세요.`)
  if (s.length > max) throw new RewardError(400, `${label}은(는) ${max}자 안으로 입력해주세요.`)
  return s
}
const intIn = (v: unknown, min: number, max: number, label: string) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new RewardError(400, `${label}은(는) ${min}~${max} 사이 정수입니다.`)
  return n
}
const setClause = (values: Record<string, unknown>, from = 2) => Object.keys(values).map((k, i) => `${k} = $${i + from}`).join(", ")
const nextOrder = async (q: Q, sql: string, id: number) => {
  const { rows } = await q.query<{ n: number }>(sql, [id])
  return (rows[0]?.n ?? 0) + 1
}

export async function adminTopics() {
  const q = db()
  const { rows: topics } = await q.query<{ id: string; title: string; description: string; sort_order: number }>(
    "SELECT id, title, description, sort_order FROM rewards.quiz_topics ORDER BY sort_order, id"
  )
  const { rows: versions } = await q.query<VersionRow & { items: number; attempts: number }>(
    `SELECT v.*,
       (SELECT count(*)::int FROM rewards.quiz_items i WHERE i.version_id = v.id) AS items,
       (SELECT count(*)::int FROM rewards.quiz_version_attempts a WHERE a.version_id = v.id) AS attempts
     FROM rewards.quiz_versions v ORDER BY v.sort_order, v.id`
  )
  return topics.map((t) => ({
    id: Number(t.id),
    title: t.title,
    description: t.description,
    versions: versions
      .filter((v) => v.topic_id === t.id)
      .map((v) => ({ id: Number(v.id), title: v.title, published: v.published, items: v.items, attempts: v.attempts })),
  }))
}

export async function createTopic(body: Record<string, unknown>) {
  const title = txt(body.title, 60, "주제 이름", true)!
  const description = txt(body.description, 200, "주제 설명", false) ?? ""
  const q = db()
  const order = await nextOrder(q, "SELECT max(sort_order) AS n FROM rewards.quiz_topics WHERE $1::int IS NOT NULL", 0)
  const { rows } = await q.query<{ id: string }>(
    "INSERT INTO rewards.quiz_topics (title, description, sort_order) VALUES ($1, $2, $3) RETURNING id",
    [title, description, order]
  )
  return Number(rows[0].id)
}

export async function updateTopic(id: number, body: Record<string, unknown>) {
  const values: Record<string, unknown> = {}
  const title = txt(body.title, 60, "주제 이름", false)
  if (title !== undefined) {
    if (!title) throw new RewardError(400, "주제 이름을 입력해주세요.")
    values.title = title
  }
  const description = txt(body.description, 200, "주제 설명", false)
  if (description !== undefined) values.description = description
  if (body.sortOrder !== undefined) values.sort_order = intIn(body.sortOrder, -100000, 100000, "순서")
  if (!Object.keys(values).length) throw new RewardError(400, "바꿀 내용이 없습니다.")
  const r = await db().query(`UPDATE rewards.quiz_topics SET ${setClause(values)}, updated_at = NOW() WHERE id = $1`, [id, ...Object.values(values)])
  if (!r.rowCount) throw new RewardError(404, "주제를 찾을 수 없습니다.")
}

export async function deleteTopic(id: number) {
  const q = db()
  const v = await q.query("SELECT 1 FROM rewards.quiz_versions WHERE topic_id = $1 LIMIT 1", [id])
  if (v.rowCount) throw new RewardError(409, "버전이 남아 있는 주제는 지울 수 없습니다. 버전을 먼저 지워주세요.")
  const r = await q.query("DELETE FROM rewards.quiz_topics WHERE id = $1", [id])
  if (!r.rowCount) throw new RewardError(404, "주제를 찾을 수 없습니다.")
}

export async function createVersion(topicId: number, body: Record<string, unknown>) {
  const title = txt(body.title, 60, "버전 이름", true)!
  const description = txt(body.description, 200, "버전 설명", false) ?? ""
  const q = db()
  const t = await q.query("SELECT 1 FROM rewards.quiz_topics WHERE id = $1", [topicId])
  if (!t.rowCount) throw new RewardError(404, "주제를 찾을 수 없습니다.")
  const order = await nextOrder(q, "SELECT max(sort_order) AS n FROM rewards.quiz_versions WHERE topic_id = $1", topicId)
  const { rows } = await q.query<{ id: string }>(
    "INSERT INTO rewards.quiz_versions (topic_id, title, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING id",
    [topicId, title, description, order]
  )
  return Number(rows[0].id)
}

// 버전 하나: 설정 + 문제·보기(정답 포함) + 푼 회원 수
export async function adminVersion(id: number) {
  const q = db()
  const { rows } = await q.query<VersionRow & { topic_title: string; attempts: number; avg_correct: number | null }>(
    `SELECT v.*, t.title AS topic_title,
       (SELECT count(*)::int FROM rewards.quiz_version_attempts a WHERE a.version_id = v.id) AS attempts,
       (SELECT avg(correct)::float FROM rewards.quiz_version_attempts a WHERE a.version_id = v.id) AS avg_correct
     FROM rewards.quiz_versions v JOIN rewards.quiz_topics t ON t.id = v.topic_id WHERE v.id = $1`,
    [id]
  )
  const v = rows[0]
  if (!v) throw new RewardError(404, "버전을 찾을 수 없습니다.")
  const items = (await itemsOf(q, [id])).get(id) ?? []
  return {
    id,
    topicId: Number(v.topic_id),
    topicTitle: v.topic_title,
    title: v.title,
    description: v.description,
    baseDp: v.base_dp,
    perCorrectDp: v.per_correct_dp,
    published: v.published,
    attempts: v.attempts,
    avgCorrect: v.avg_correct,
    items: items.map((it) => ({ ...it, ready: itemReady(it) })),
  }
}

export async function updateVersion(id: number, body: Record<string, unknown>) {
  const values: Record<string, unknown> = {}
  const title = txt(body.title, 60, "버전 이름", false)
  if (title !== undefined) {
    if (!title) throw new RewardError(400, "버전 이름을 입력해주세요.")
    values.title = title
  }
  const description = txt(body.description, 200, "버전 설명", false)
  if (description !== undefined) values.description = description
  if (body.baseDp !== undefined) values.base_dp = intIn(body.baseDp, 0, 1000, "참여 DP")
  if (body.perCorrectDp !== undefined) values.per_correct_dp = intIn(body.perCorrectDp, 0, 1000, "정답 DP")
  if (body.sortOrder !== undefined) values.sort_order = intIn(body.sortOrder, -100000, 100000, "순서")
  if (typeof body.published === "boolean") {
    if (body.published) {
      const items = (await itemsOf(db(), [id])).get(id) ?? []
      if (!items.length) throw new RewardError(400, "문제를 하나 이상 넣어야 공개할 수 있습니다.")
      const bad = items.findIndex((it) => !itemReady(it))
      if (bad >= 0) throw new RewardError(400, `${bad + 1}번 문제에 보기 2개 이상과 정답 하나를 정해주세요.`)
    }
    values.published = body.published
  }
  if (!Object.keys(values).length) throw new RewardError(400, "바꿀 내용이 없습니다.")
  const r = await db().query(`UPDATE rewards.quiz_versions SET ${setClause(values)}, updated_at = NOW() WHERE id = $1`, [id, ...Object.values(values)])
  if (!r.rowCount) throw new RewardError(404, "버전을 찾을 수 없습니다.")
}

export async function deleteVersion(id: number) {
  const q = db()
  const a = await q.query("SELECT 1 FROM rewards.quiz_version_attempts WHERE version_id = $1 LIMIT 1", [id])
  if (a.rowCount) throw new RewardError(409, "이미 푼 회원이 있는 버전은 지울 수 없습니다. 대신 비공개로 바꿔주세요.")
  const r = await q.query("DELETE FROM rewards.quiz_versions WHERE id = $1", [id])
  if (!r.rowCount) throw new RewardError(404, "버전을 찾을 수 없습니다.")
}

const versionOfItem = async (q: Q, itemId: number) => {
  const { rows } = await q.query<{ version_id: string }>("SELECT version_id FROM rewards.quiz_items WHERE id = $1", [itemId])
  if (!rows[0]) throw new RewardError(404, "문제를 찾을 수 없습니다.")
  return Number(rows[0].version_id)
}
const itemOfOption = async (q: Q, optionId: number) => {
  const { rows } = await q.query<{ item_id: string }>("SELECT item_id FROM rewards.quiz_item_options WHERE id = $1", [optionId])
  if (!rows[0]) throw new RewardError(404, "보기를 찾을 수 없습니다.")
  return Number(rows[0].item_id)
}

// 문제 추가 → 버전 id
export async function createItem(versionId: number, body: Record<string, unknown>) {
  const question = txt(body.question, 300, "문제", true)!
  const explanation = txt(body.explanation, 300, "해설", false) ?? ""
  const q = db()
  const v = await q.query("SELECT 1 FROM rewards.quiz_versions WHERE id = $1", [versionId])
  if (!v.rowCount) throw new RewardError(404, "버전을 찾을 수 없습니다.")
  const { rows } = await q.query<{ n: number }>("SELECT count(*)::int AS n FROM rewards.quiz_items WHERE version_id = $1", [versionId])
  if (rows[0].n >= QUIZ_MAX_ITEMS) throw new RewardError(400, `문제는 버전마다 ${QUIZ_MAX_ITEMS}개까지입니다.`)
  const order = await nextOrder(q, "SELECT max(sort_order) AS n FROM rewards.quiz_items WHERE version_id = $1", versionId)
  await q.query("INSERT INTO rewards.quiz_items (version_id, question, explanation, sort_order) VALUES ($1, $2, $3, $4)", [
    versionId,
    question,
    explanation,
    order,
  ])
  return versionId
}

export async function updateItem(id: number, body: Record<string, unknown>) {
  const values: Record<string, unknown> = {}
  const question = txt(body.question, 300, "문제", false)
  if (question !== undefined) {
    if (!question) throw new RewardError(400, "문제를 입력해주세요.")
    values.question = question
  }
  const explanation = txt(body.explanation, 300, "해설", false)
  if (explanation !== undefined) values.explanation = explanation
  if (!Object.keys(values).length) throw new RewardError(400, "바꿀 내용이 없습니다.")
  const q = db()
  const versionId = await versionOfItem(q, id)
  await q.query(`UPDATE rewards.quiz_items SET ${setClause(values)}, updated_at = NOW() WHERE id = $1`, [id, ...Object.values(values)])
  return versionId
}

export async function deleteItem(id: number) {
  return tx(async (client) => {
    const versionId = await versionOfItem(client, id)
    const { rows } = await client.query<{ published: boolean; n: number }>(
      "SELECT v.published, (SELECT count(*)::int FROM rewards.quiz_items WHERE version_id = v.id) AS n FROM rewards.quiz_versions v WHERE v.id = $1",
      [versionId]
    )
    if (rows[0]?.published && rows[0].n <= 1) throw new RewardError(400, "공개 중인 버전의 마지막 문제는 지울 수 없습니다. 비공개로 바꾼 뒤 지워주세요.")
    await client.query("DELETE FROM rewards.quiz_items WHERE id = $1", [id])
    return versionId
  })
}

// 위·아래로 한 칸 (같은 버전 안에서 옆 문제와 순서를 바꿈)
export async function moveItem(id: number, dir: unknown) {
  if (dir !== "up" && dir !== "down") throw new RewardError(400, "잘못된 요청입니다.")
  return tx(async (client) => {
    const versionId = await versionOfItem(client, id)
    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM rewards.quiz_items WHERE version_id = $1 ORDER BY sort_order, id FOR UPDATE",
      [versionId]
    )
    const ids = rows.map((r) => Number(r.id))
    const i = ids.indexOf(id)
    const j = dir === "up" ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= ids.length) return versionId
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    for (const [n, itemId] of ids.entries()) await client.query("UPDATE rewards.quiz_items SET sort_order = $2 WHERE id = $1", [itemId, n + 1])
    return versionId
  })
}

// 보기 하나 추가 (isAnswer 면 이 보기를 정답으로, 다른 보기의 정답 표시는 지움)
export async function createOption(itemId: number, body: Record<string, unknown>) {
  const label = txt(body.label, 100, "보기", true)!
  return tx(async (client) => {
    const versionId = await versionOfItem(client, itemId)
    const { rows } = await client.query<{ n: number; m: number | null }>(
      "SELECT count(*)::int AS n, max(sort_order) AS m FROM rewards.quiz_item_options WHERE item_id = $1",
      [itemId]
    )
    if (rows[0].n >= QUIZ_MAX_OPTIONS) throw new RewardError(400, `보기는 문제마다 ${QUIZ_MAX_OPTIONS}개까지입니다.`)
    const isAnswer = body.isAnswer === true
    if (isAnswer) await client.query("UPDATE rewards.quiz_item_options SET is_answer = FALSE WHERE item_id = $1", [itemId])
    await client.query("INSERT INTO rewards.quiz_item_options (item_id, label, is_answer, sort_order) VALUES ($1, $2, $3, $4)", [
      itemId,
      label,
      isAnswer,
      (rows[0].m ?? 0) + 1,
    ])
    return versionId
  })
}

export async function updateOption(id: number, body: Record<string, unknown>) {
  return tx(async (client) => {
    const itemId = await itemOfOption(client, id)
    const versionId = await versionOfItem(client, itemId)
    const label = txt(body.label, 100, "보기", false)
    if (label !== undefined) {
      if (!label) throw new RewardError(400, "보기를 입력해주세요.")
      await client.query("UPDATE rewards.quiz_item_options SET label = $2 WHERE id = $1", [id, label])
    }
    if (body.isAnswer === true) {
      await client.query("UPDATE rewards.quiz_item_options SET is_answer = FALSE WHERE item_id = $1", [itemId])
      await client.query("UPDATE rewards.quiz_item_options SET is_answer = TRUE WHERE id = $1", [id])
    }
    return versionId
  })
}

export async function deleteOption(id: number) {
  return tx(async (client) => {
    const itemId = await itemOfOption(client, id)
    const versionId = await versionOfItem(client, itemId)
    await client.query("DELETE FROM rewards.quiz_item_options WHERE id = $1", [id])
    return versionId
  })
}
