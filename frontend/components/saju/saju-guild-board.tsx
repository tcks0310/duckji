"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Users, 
  Sparkles, 
  Heart, 
  MessageSquare, 
  Send, 
  Flame, 
  ShieldAlert, 
  Share2, 
  Compass,
  ArrowRight,
  UserPlus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { IsekaiProfile } from "@/lib/saju-engine"
import { INITIAL_GUILD_POSTS, GuildPost } from "@/data/saju-data"
import { SampleBadge } from "@/components/ui/sample-badge"

interface SajuGuildBoardProps {
  currentProfile?: IsekaiProfile | null
  onStartMySaju: () => void
}

export function SajuGuildBoard({ currentProfile, onStartMySaju }: SajuGuildBoardProps) {
  const [posts, setPosts] = useState<GuildPost[]>(INITIAL_GUILD_POSTS)
  const [selectedFilter, setSelectedFilter] = useState<string>("all")
  const [newPostText, setNewPostText] = useState("")
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({})
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")

  const handleToggleLike = (postId: string) => {
    setLikedPosts((prev) => {
      const isLiked = !prev[postId]
      setPosts((pList) =>
        pList.map((p) =>
          p.id === postId ? { ...p, likeCount: p.likeCount + (isLiked ? 1 : -1) } : p
        )
      )
      return { ...prev, [postId]: isLiked }
    })
  }

  const handleAddPost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPostText.trim()) return

    const newPost: GuildPost = {
      id: `post-${Date.now()}`,
      userName: currentProfile ? currentProfile.heroNickname : "익명의 모험가",
      userTitle: currentProfile ? currentProfile.characterTitle : "Lv.1 모험가 지망생",
      userElement: currentProfile ? currentProfile.primaryElement.type : "fire",
      elementLabel: currentProfile ? currentProfile.primaryElement.korean : "화(火) 속성",
      mbti: currentProfile ? currentProfile.mbti : "INFP",
      favoriteAnimeTags: currentProfile ? currentProfile.favoriteAnimeList : ["귀멸의 칼날", "주술회전"],
      avatarUrl: currentProfile
        ? currentProfile.avatarImage
        : "/images/avatar/fire.jpg",
      content: newPostText,
      bestMatchElement: currentProfile
        ? `${currentProfile.primaryElement.type === "wood" ? "화(火)" : currentProfile.primaryElement.type === "fire" ? "목(木)" : "수(水)"} 속성 모험가`
        : "오행 상생 모험가",
      likeCount: 0,
      commentCount: 0,
      createdAt: "방금 전",
      comments: []
    }

    setPosts([newPost, ...posts])
    setNewPostText("")
  }

  const handleAddComment = (postId: string) => {
    if (!commentText.trim()) return
    const newComment = {
      id: `c-${Date.now()}`,
      author: currentProfile ? currentProfile.heroNickname : "지나가는 용사",
      avatar: currentProfile
        ? currentProfile.avatarImage
        : "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200&auto=format&fit=crop",
      text: commentText,
      time: "방금 전"
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              commentCount: p.commentCount + 1,
              comments: [...p.comments, newComment]
            }
          : p
      )
    )
    setCommentText("")
  }

  const filteredPosts = selectedFilter === "all"
    ? posts
    : posts.filter((p) => p.userElement === selectedFilter)

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>ADVENTURER GUILD PLAZA</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            덕지 사주 모험가 길드 광장
            <SampleBadge />
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            사주 결과를 공유하고, 나와 상생 궁합인 속성의 팝업스토어 파티원을 모집해보세요!
          </p>
        </div>

        {!currentProfile && (
          <Button
            onClick={onStartMySaju}
            className="bg-red-600 text-white font-black rounded-2xl text-xs py-3 px-5 shadow-lg"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            내 사주 풀고 참가하기
          </Button>
        )}
      </div>

      {/* Share / Post Box */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl space-y-3">
        <div className="flex items-center gap-3">
          <img
            src={
              currentProfile
                ? currentProfile.avatarImage
                : "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=200&auto=format&fit=crop"
            }
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-zinc-700"
          />
          <div className="flex-1">
            <div className="text-xs font-bold text-white">
              {currentProfile ? currentProfile.heroNickname : "게스트 모험가"}
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">
              {currentProfile ? currentProfile.characterTitle : "사주를 풀면 VIP 칭호가 부여됩니다"}
            </div>
          </div>
        </div>

        <form onSubmit={handleAddPost} className="space-y-3">
          <textarea
            rows={2}
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="사주 풀이 소감이나 팝업스토어 동행 파티원 모집 글을 작성해보세요!"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs px-4"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              광장에 공유하기
            </Button>
          </div>
        </form>
      </div>

      {/* Elemental Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "all", label: "전체 속성" },
          { id: "wood", label: "🌲 목(木) 속성" },
          { id: "fire", label: "🔥 화(火) 속성" },
          { id: "earth", label: "⛰️ 토(土) 속성" },
          { id: "metal", label: "⚔️ 금(金) 속성" },
          { id: "water", label: "💧 수(水) 속성" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedFilter === tab.id
                ? "bg-emerald-500 text-black shadow-md"
                : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feed List */}
      <div className="space-y-4">
        {filteredPosts.map((post) => {
          const isLiked = likedPosts[post.id]
          const isCommentsOpen = activeCommentId === post.id

          return (
            <div
              key={post.id}
              className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 shadow-lg backdrop-blur-md space-y-4"
            >
              {/* Post Author */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={post.avatarUrl}
                    alt={post.userName}
                    className="w-11 h-11 rounded-2xl object-cover border border-zinc-700"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{post.userName}</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-zinc-950 text-emerald-400 border border-zinc-800">
                        {post.elementLabel}
                      </span>
                      {post.mbti && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {post.mbti}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400">{post.userTitle}</div>
                    {post.favoriteAnimeTags && post.favoriteAnimeTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {post.favoriteAnimeTags.map((tag, tIdx) => (
                          <span key={tIdx} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-zinc-500">{post.createdAt}</span>
              </div>

              {/* Content */}
              <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/80">
                {post.content}
              </p>

              {/* Synergy Partner Tag & Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs">
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold">
                  <Sparkles className="w-3 h-3" />
                  <span>추천 궁합: {post.bestMatchElement}</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleLike(post.id)}
                    className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                      isLiked ? "text-rose-500" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? "fill-rose-500" : ""}`} />
                    <span>{post.likeCount}</span>
                  </button>

                  <button
                    onClick={() => setActiveCommentId(isCommentsOpen ? null : post.id)}
                    className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.commentCount}</span>
                  </button>
                </div>
              </div>

              {/* Comments Section */}
              <AnimatePresence>
                {isCommentsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pt-3 border-t border-zinc-800 space-y-3 overflow-hidden"
                  >
                    {/* Existing Comments */}
                    {post.comments.length > 0 && (
                      <div className="space-y-2">
                        {post.comments.map((c) => (
                          <div key={c.id} className="flex gap-2.5 bg-zinc-950 p-2.5 rounded-xl border border-zinc-850">
                            <img src={c.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                            <div className="flex-1 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">{c.author}</span>
                                <span className="text-[9px] text-zinc-500">{c.time}</span>
                              </div>
                              <p className="text-zinc-300 mt-0.5">{c.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Comment Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="댓글을 입력하세요..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddComment(post.id)
                          }
                        }}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddComment(post.id)}
                        className="bg-zinc-800 hover:bg-emerald-500 hover:text-black text-white text-xs font-bold rounded-xl px-3"
                      >
                        등록
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
