"use client"

import { useState } from "react"
import { MapPin, Search } from "lucide-react"
import { searchPlaces, type PlaceResult } from "@/lib/place-search"

// 장소 검색 칸 (카카오 → 네이버): 매장·건물 이름이나 주소를 치고 고르면 이름·주소·지도 위치를 한 번에 채움
export function PlaceSearch({
  onPick,
  inputClass,
  placeholder = "장소 이름이나 주소 (예: 더현대 서울, 성수 무신사)",
}: {
  onPick: (place: PlaceResult) => void
  inputClass: string
  placeholder?: string
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PlaceResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")

  const run = async () => {
    if (!query.trim()) return
    setBusy(true)
    setNote("")
    try {
      const r = await searchPlaces(query)
      if (!r.configured) {
        setResults(null)
        setNote("장소 검색을 지금 쓸 수 없어요. 주소 검색을 이용해주세요.")
      } else {
        setResults(r.places)
        if (!r.places.length) setNote("찾은 장소가 없어요. 이름을 줄이거나 지역을 붙여 다시 찾아보세요. (예: 성수 무신사)")
      }
    } catch (e: any) {
      setNote(e?.message || "장소를 찾지 못했어요.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              run()
            }
          }}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-100 disabled:opacity-60"
        >
          <Search className="w-4 h-4" />
          {busy ? "찾는 중..." : "찾기"}
        </button>
      </div>
      {results && results.length > 0 && (
        <ul className="rounded-lg border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
          {results.map((p, i) => (
            <li key={`${p.name}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(p)
                  setResults(null)
                  setNote(`'${p.name}' 위치로 정했어요. 자리가 다르면 지도를 눌러 옮겨주세요.`)
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-zinc-800/70 flex items-start gap-2"
              >
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-zinc-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">
                    {p.name}
                    {p.category && <span className="ml-2 text-xs font-normal text-zinc-500">{p.category}</span>}
                  </span>
                  <span className="block text-xs text-zinc-400 truncate">{p.address}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-xs text-zinc-400">{note}</p>}
    </div>
  )
}
