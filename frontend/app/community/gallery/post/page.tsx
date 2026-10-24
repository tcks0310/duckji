"use client"

import * as React from "react"
import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, BarChart3, ExternalLink, Eye, Link2, MessageCircle, Pencil, Pin, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react"
import { AuthorName, Notice } from "@/components/gallery/gallery-shell"
import { GalleryLayout } from "@/components/gallery/gallery-layout"
import { HashtagList, MediaCarousel } from "@/components/gallery/post-cards"
import { ReportButton } from "@/components/gallery/report-box"
import {
  ApiError,
  createComment,
  deleteComment,
  deletePost,
  fetchComments,
  fetchPost,
  formatPostDate,
  galleryHref,
  reactToPost,
  squadHomeHref,
  votePoll,
  type Comment,
  type Permissions,
  type Poll,
  type Post,
} from "@/lib/community-api"
import { fetchPartyEventByPost, type PartyEvent } from "@/lib/party-api"

// 글 상세 (/community/gallery/post?id=1): 사진·동영상 · 해시태그 · SNS 링크 · 투표 · 덕업/덕다운 · 댓글 · 신고
export default function GalleryPostPage() {
  return (
    <Suspense fallback={null}>
      <GalleryPost />
    </Suspense>
  )
}

type Viewer = Permissions & { loggedIn: boolean; memberId: string | null; isAuthor: boolean; isAdmin: boolean; reaction: -1 | 0 | 1 }

function GalleryPost() {
  const router = useRouter()
  const postId = Number(useSearchParams().get("id"))
  const [post, setPost] = useState<Post | null>(null)
  const [gallery, setGallery] = useState<{ slug: string; name: string } | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")
  const [partyEvent, setPartyEvent] = useState<PartyEvent | null>(null)

  const loadComments = useCallback(() => fetchComments(postId).then(setComments), [postId])

  useEffect(() => {
    if (!postId) return setError("글을 찾을 수 없습니다.")
    // "파티할래요?" 글이면 연결된 파티 이벤트로 돌아가는 링크 (없으면 404 → 무시)
    fetchPartyEventByPost(postId).then(setPartyEvent).catch(() => setPartyEvent(null))
    fetchPost(postId)
      .then((d) => {
        setPost(d.post)
        setGallery(d.gallery)
        setViewer(d.viewer)
      })
      .catch((e) => setError(e.message))
    loadComments().catch(() => {})
  }, [postId, loadComments])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(""), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      router.push("/login")
      return
    }
    setToast(e instanceof Error ? e.message : "요청을 처리하지 못했습니다.")
  }

  const handleReaction = async (value: 1 | -1) => {
    if (!post || !viewer) return
    if (!viewer.loggedIn) return router.push("/login")
    try {
      const r = await reactToPost(post.id, viewer.reaction === value ? 0 : value)
      setViewer({ ...viewer, reaction: r.reaction })
      setPost({ ...post, upCount: r.upCount, downCount: r.downCount })
    } catch (e) {
      fail(e)
    }
  }

  const handleDelete = async () => {
    if (!post || !confirm("글을 지울까요? 이 글로 받은 덕력도 함께 빠져요.")) return
    try {
      await deletePost(post.id)
      router.push(gallery ? galleryHref(gallery.slug) : "/community/gallery/")
    } catch (e) {
      fail(e)
    }
  }

  if (error) {
    return (
      <GalleryLayout>
        <Notice tone="error">{error}</Notice>
      </GalleryLayout>
    )
  }
  if (!post || !viewer || !gallery) {
    return (
      <GalleryLayout>
        <Notice>불러오는 중...</Notice>
      </GalleryLayout>
    )
  }

  const canManage = viewer.isAuthor || viewer.isAdmin

  return (
    <GalleryLayout activeSlug={gallery.slug}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={galleryHref(gallery.slug)} className="inline-flex items-center gap-1 text-zinc-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          {gallery.name}
        </Link>
        {partyEvent && (
          <Link href={`/funding/party/event?slug=${encodeURIComponent(partyEvent.slug)}`} className="text-emerald-400 hover:underline">
            {partyEvent.title} 파티 이벤트로
          </Link>
        )}
      </div>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <header className="p-4 sm:p-5 space-y-2 border-b border-zinc-800">
          <h1 className="text-xl sm:text-2xl font-bold text-white break-words">
            {post.isNotice && (
              <span className="mr-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500 text-white text-sm font-bold align-middle">
                <Pin className="w-3.5 h-3.5" />
                공지
              </span>
            )}
            {post.head && <span className="text-zinc-500 mr-1.5">[{post.head}]</span>}
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-zinc-500">
            {post.postedAsSquad && (
              <Link href={squadHomeHref(post.postedAsSquad.id)} className="font-bold text-emerald-300 hover:underline">
                {post.postedAsSquad.name} 스쿼드
              </Link>
            )}
            <AuthorName author={post} avatar />
            <span>{formatPostDate(post.createdAt)}</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {post.viewCount.toLocaleString()}
            </span>
            {post.status !== "published" && <span className="text-red-400 font-semibold">{post.status === "hidden" ? "숨김 처리된 글" : "지운 글"}</span>}
          </div>
        </header>

        {post.media.length > 0 && (
          <div className="p-3 sm:p-4 pb-0 sm:pb-0">
            <MediaCarousel media={post.media} />
          </div>
        )}

        <div className="p-4 sm:p-5 space-y-4">
          {post.body && <div className="text-[15px] leading-relaxed text-zinc-200 whitespace-pre-wrap break-words">{post.body}</div>}
          <HashtagList tags={post.hashtags} />
          {post.links.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {post.links.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-emerald-500"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {l.label}
                    <ExternalLink className="w-3 h-3 text-zinc-500" />
                  </a>
                </li>
              ))}
            </ul>
          )}

          {post.poll && <PollView postId={post.id} poll={post.poll} loggedIn={viewer.loggedIn} onChange={(poll) => setPost({ ...post, poll })} onError={fail} />}

          {/* 덕업·덕다운: 한 사람이 한 글에 하나. 다시 누르면 취소 */}
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleReaction(1)}
              disabled={viewer.isAuthor}
              aria-pressed={viewer.reaction === 1}
              className={`flex flex-col items-center min-w-[5.5rem] px-4 py-2.5 rounded-2xl border transition-colors disabled:opacity-50 ${
                viewer.reaction === 1 ? "border-emerald-400 bg-emerald-500/15 text-emerald-200" : "border-zinc-700 text-zinc-300 hover:border-emerald-500"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <ThumbsUp className="w-4 h-4" />
                덕업
              </span>
              <span className="text-lg font-bold">{post.upCount}</span>
            </button>
            <button
              type="button"
              onClick={() => handleReaction(-1)}
              disabled={viewer.isAuthor}
              aria-pressed={viewer.reaction === -1}
              className={`flex flex-col items-center min-w-[5.5rem] px-4 py-2.5 rounded-2xl border transition-colors disabled:opacity-50 ${
                viewer.reaction === -1 ? "border-zinc-400 bg-zinc-700/40 text-zinc-100" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <ThumbsDown className="w-4 h-4" />
                덕다운
              </span>
              <span className="text-lg font-bold">{post.downCount}</span>
            </button>
          </div>
          {viewer.isAuthor && <p className="text-center text-xs text-zinc-500">내 글에는 덕업·덕다운을 누를 수 없어요.</p>}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-zinc-800">
            {viewer.isAuthor && post.status === "published" && (
              <Link href={`/community/gallery/write/?id=${post.id}`} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
                <Pencil className="w-3 h-3" />
                고치기
              </Link>
            )}
            {canManage && post.status !== "deleted" && (
              <button type="button" onClick={handleDelete} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-400">
                <Trash2 className="w-3 h-3" />
                지우기
              </button>
            )}
            {viewer.loggedIn && !viewer.isAuthor && <ReportButton targetType="post" targetId={post.id} label="글 신고" onError={fail} />}
            {viewer.loggedIn && !viewer.isAuthor && post.authorId !== "admin" && (
              <ReportButton targetType="member" targetId={post.authorId} label="글쓴이 신고" onError={fail} />
            )}
          </div>
        </div>
      </article>

      <Comments
        postId={post.id}
        postAuthorId={post.authorId}
        comments={comments}
        viewer={viewer}
        onChanged={(earned) => {
          loadComments().catch(() => {})
          setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p))
          if (earned) setToast(`덕력 +${earned}`)
        }}
        reload={() => loadComments().catch(() => {})}
        onError={fail}
      />

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </GalleryLayout>
  )
}

// 투표: 고르면 바로 투표, 결과는 투표한 뒤·마감 뒤에 보임. 투표 중에는 다른 후보로 바꿀 수 있음
function PollView({ postId, poll, loggedIn, onChange, onError }: { postId: number; poll: Poll; loggedIn: boolean; onChange: (p: Poll) => void; onError: (e: unknown) => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const pick = async (optionId: number) => {
    if (!loggedIn) return router.push("/login")
    if (poll.closed || busy) return
    setBusy(true)
    try {
      const next = await votePoll(postId, optionId)
      if (next) onChange(next)
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }
  const showResults = poll.totalVotes !== null
  return (
    <section className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-bold text-white">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          {poll.question}
        </h2>
        <span className="text-xs text-zinc-500">
          {poll.closed ? "마감됨" : poll.endsAt ? `${new Date(poll.endsAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} 마감` : "진행 중"}
          {showResults && ` · ${poll.totalVotes!.toLocaleString()}표`}
        </span>
      </div>
      <ul className="grid sm:grid-cols-2 gap-2">
        {poll.options.map((o) => {
          const mine = poll.myOptionId === o.id
          const pct = showResults && poll.totalVotes ? Math.round(((o.voteCount || 0) / poll.totalVotes) * 100) : 0
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => pick(o.id)}
                disabled={poll.closed || busy}
                className={`relative w-full flex items-center gap-3 p-2.5 rounded-xl border text-left overflow-hidden transition-colors ${
                  mine ? "border-emerald-400" : "border-zinc-700 hover:border-zinc-500"
                } disabled:cursor-default`}
              >
                {showResults && <span className="absolute inset-y-0 left-0 bg-emerald-500/15" style={{ width: `${pct}%` }} aria-hidden />}
                {o.imageUrl && <img src={o.imageUrl} alt="" className="relative w-12 h-12 rounded-lg object-cover shrink-0" />}
                <span className="relative flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-zinc-100 truncate">
                    {o.label}
                    {mine && <span className="ml-1.5 text-xs text-emerald-300">내 선택</span>}
                  </span>
                  {o.description && <span className="block text-xs text-zinc-400 line-clamp-2">{o.description}</span>}
                </span>
                {showResults && <span className="relative text-sm font-bold text-zinc-200 shrink-0">{pct}%</span>}
              </button>
              {o.linkUrl && (
                <a href={o.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
                  <ExternalLink className="w-3 h-3" />
                  자세히 보기
                </a>
              )}
            </li>
          )
        })}
      </ul>
      {!showResults && !poll.closed && <p className="text-xs text-zinc-500">투표하면 결과를 볼 수 있어요. 마감 전에는 다른 후보로 바꿀 수 있어요.</p>}
    </section>
  )
}

function Comments({
  postId,
  postAuthorId,
  comments,
  viewer,
  onChanged,
  reload,
  onError,
}: {
  postId: number
  postAuthorId: string
  comments: Comment[]
  viewer: Viewer
  onChanged: (earned: number) => void
  reload: () => void
  onError: (e: unknown) => void
}) {
  const [text, setText] = useState("")
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [isSending, setIsSending] = useState(false)
  const roots = comments.filter((c) => !c.parentId)
  const repliesOf = (id: number) => comments.filter((c) => c.parentId === id)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setIsSending(true)
    try {
      const r = await createComment(postId, text.trim(), replyTo?.id ?? null)
      setText("")
      setReplyTo(null)
      onChanged(r.earned)
    } catch (err) {
      onError(err)
    } finally {
      setIsSending(false)
    }
  }

  const remove = async (c: Comment) => {
    if (!confirm("댓글을 지울까요? 이 댓글로 받은 덕력도 함께 빠져요.")) return
    try {
      await deleteComment(c.id)
      reload()
    } catch (e) {
      onError(e)
    }
  }

  const row = (c: Comment, isReply: boolean) => {
    const alive = c.status === "published"
    const mine = viewer.memberId === c.authorId || (viewer.isAdmin && c.authorId === "admin")
    return (
      <div className={`py-3 ${isReply ? "pl-6 sm:pl-8 border-l-2 border-zinc-800 ml-2" : ""}`}>
        {alive ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <AuthorName author={c} />
            {c.authorId === postAuthorId && <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">글쓴이</span>}
            <span>{formatPostDate(c.createdAt)}</span>
          </div>
        ) : null}
        <p className={`mt-1 text-sm whitespace-pre-wrap break-words ${alive ? "text-zinc-200" : "text-zinc-600 italic"}`}>{c.body}</p>
        {alive && (
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {!isReply && viewer.canComment && (
              <button type="button" onClick={() => setReplyTo(c)} className="text-xs text-zinc-500 hover:text-white">
                답글
              </button>
            )}
            {(mine || viewer.isAdmin) && (
              <button type="button" onClick={() => remove(c)} className="text-xs text-zinc-500 hover:text-red-400">
                지우기
              </button>
            )}
            {viewer.loggedIn && !mine && <ReportButton targetType="comment" targetId={c.id} onError={onError} />}
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 space-y-3">
      <h2 className="flex items-center gap-1.5 text-base font-bold text-white">
        <MessageCircle className="w-4 h-4" />
        댓글 {comments.filter((c) => c.status === "published").length}
      </h2>
      <div className="divide-y divide-zinc-800/70">
        {roots.map((c) => (
          <div key={c.id}>
            {row(c, false)}
            {repliesOf(c.id).map((r) => (
              <div key={r.id}>{row(r, true)}</div>
            ))}
          </div>
        ))}
        {!roots.length && <p className="py-4 text-sm text-zinc-500">첫 댓글을 남겨 보세요. 댓글 하나에 덕력 10 (하루 5번까지)</p>}
      </div>

      {viewer.canComment ? (
        <form onSubmit={submit} className="space-y-2 pt-2 border-t border-zinc-800">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{replyTo.authorName} 님에게 답글</span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-white">
                취소
              </button>
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="댓글을 남겨 주세요"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={isSending || !text.trim()} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40">
              {isSending ? "등록 중..." : "댓글 등록"}
            </button>
          </div>
        </form>
      ) : (
        <p className="pt-2 border-t border-zinc-800 text-sm text-zinc-500">
          {viewer.commentBlockedReason}
          {!viewer.loggedIn && (
            <Link href="/login" className="ml-1.5 text-emerald-400 font-semibold">
              로그인
            </Link>
          )}
        </p>
      )}
    </section>
  )
}
