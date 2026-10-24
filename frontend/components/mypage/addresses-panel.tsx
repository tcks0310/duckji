"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { searchAddress } from "@/lib/postcode"
import { addMyAddress, deleteMyAddress, updateMyAddress, type AddressForm, type MyAddress, type MyInfo } from "@/lib/member-auth"

// 마이페이지 배송지 관리 (/mypage/?tab=address): 목록·추가·수정·삭제·기본 배송지 지정 (최대 10개)
// 가입 때는 주소를 받지 않고, 첫 굿즈 주문 때 저장하거나 여기서 직접 추가함. 주소는 서버가 암호화해 저장
// 화면은 로그인 연동 탭과 같은 '얇은 선으로 나눈 줄' 모양

const input =
  "w-full h-10 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
const lineBtn = "h-9 px-3 text-sm text-zinc-400 hover:text-white hover:bg-transparent"

const empty: AddressForm = { label: "", recipient: "", phone: "", zipCode: "", address1: "", address2: "", isDefault: false }

const formOf = (a: MyAddress): AddressForm => ({
  label: a.label || "",
  recipient: a.recipient || "",
  phone: a.phone || "",
  zipCode: a.zipCode,
  address1: a.address1 || "",
  address2: a.address2 || "",
  isDefault: a.isDefault,
})

export function AddressesPanel({ info, reload }: { info: MyInfo; reload: () => Promise<void> }) {
  const list = info.addresses || []
  // editing: null = 닫힘, "new" = 새 배송지, 숫자 = 그 배송지 수정
  const [editing, setEditing] = useState<null | "new" | number>(null)
  const [form, setForm] = useState<AddressForm>(empty)
  const [busy, setBusy] = useState(false)

  const open = (target: "new" | MyAddress) => {
    setEditing(target === "new" ? "new" : target.id)
    setForm(target === "new" ? { ...empty, isDefault: list.length === 0 } : formOf(target))
  }
  const set = (k: keyof AddressForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  const findAddress = async () => {
    try {
      const r = await searchAddress()
      if (r) setForm((f) => ({ ...f, zipCode: r.zonecode, address1: r.address, address2: "" }))
    } catch (e: any) {
      alert(e?.message || "주소 검색을 열지 못했어요.")
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editing === null) return
    if (!form.zipCode || !form.address1) return alert("주소 검색으로 주소를 찾아 주세요.")
    setBusy(true)
    const body = { ...form, phone: form.phone.replace(/[^\d]/g, "") }
    const r = editing === "new" ? await addMyAddress(body) : await updateMyAddress(editing, body)
    setBusy(false)
    if (!r.success) return alert(r.error)
    setEditing(null)
    await reload()
  }

  const remove = async (a: MyAddress) => {
    if (!window.confirm(`'${a.label || a.address1}' 배송지를 지울까요?`)) return
    setBusy(true)
    const r = await deleteMyAddress(a.id)
    setBusy(false)
    if (!r.success) return alert(r.error)
    await reload()
  }

  const makeDefault = async (a: MyAddress) => {
    setBusy(true)
    const f = formOf(a)
    const r = await updateMyAddress(a.id, { ...f, phone: f.phone.replace(/[^\d]/g, ""), isDefault: true })
    setBusy(false)
    if (!r.success) return alert(r.error)
    await reload()
  }

  const editor = (
    <form onSubmit={save} className="py-4 space-y-3">
      <div className="grid sm:grid-cols-[1fr_1fr_1fr] gap-3">
        <input className={input} maxLength={30} placeholder="배송지 이름 (예: 집)" value={form.label || ""} onChange={(e) => set("label", e.target.value)} />
        <input className={input} required maxLength={30} placeholder="받는 분 이름" value={form.recipient} onChange={(e) => set("recipient", e.target.value)} />
        <input className={input} required maxLength={20} inputMode="tel" placeholder="연락처 (010-0000-0000)" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div className="flex gap-3">
        <div className="w-28 shrink-0">
                          <input className={`${input} cursor-pointer`} required readOnly placeholder="우편번호" value={form.zipCode} onClick={findAddress} />
                        </div>
        <Button type="button" onClick={findAddress} className="h-10 px-4 shrink-0 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold">
          주소 검색
        </Button>
      </div>
      <input className={`${input} cursor-pointer`} required readOnly placeholder="주소 검색을 눌러 주소를 찾아 주세요" value={form.address1} onClick={findAddress} />
      <input className={input} maxLength={100} placeholder="상세 주소 (동·호수)" value={form.address2 || ""} onChange={(e) => set("address2", e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
        <input type="checkbox" checked={Boolean(form.isDefault)} onChange={(e) => set("isDefault", e.target.checked)} className="rounded border-zinc-700 text-red-500 focus:ring-red-500" />
        기본 배송지로 쓰기
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="h-10 px-6 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm">
          {busy ? "저장 중..." : "저장"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(null)} className={lineBtn}>
          취소
        </Button>
      </div>
    </form>
  )

  return (
    <div className="max-w-3xl space-y-4">
      <div className="border-y border-zinc-800 divide-y divide-zinc-800 -mt-2 border-t-0">
        {list.length === 0 && editing !== "new" && <p className="py-5 text-sm text-zinc-500">저장한 배송지가 없어요. 첫 주문 때 저장하거나 여기서 추가할 수 있어요.</p>}
        {list.map((a) =>
          editing === a.id ? (
            <div key={a.id}>{editor}</div>
          ) : (
            <div key={a.id} className="flex items-start gap-3 py-4">
              <div className="flex-1 min-w-0 text-sm">
                <div className="font-bold text-white">
                  {a.label || "배송지"}
                  {a.isDefault && <span className="ml-2 px-1.5 py-0.5 rounded bg-zinc-800 text-xs text-zinc-300 font-bold">기본</span>}
                </div>
                <div className="mt-0.5 text-zinc-400">
                  {a.recipient} · {a.phone}
                </div>
                <div className="mt-0.5 text-zinc-500 break-keep">
                  ({a.zipCode}) {a.address1} {a.address2}
                </div>
              </div>
              <div className="flex flex-wrap justify-end">
                {!a.isDefault && (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => makeDefault(a)} className={lineBtn}>
                    기본으로
                  </Button>
                )}
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => open(a)} className={lineBtn}>
                  수정
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(a)} className="h-9 px-3 text-sm text-zinc-400 hover:text-red-400 hover:bg-transparent">
                  삭제
                </Button>
              </div>
            </div>
          )
        )}
        {editing === "new" && editor}
      </div>
      {editing === null && list.length < 10 && (
        <Button variant="outline" onClick={() => open("new")} className="h-10 px-4 rounded-lg border border-zinc-700 bg-transparent text-sm text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-transparent">
          배송지 추가
        </Button>
      )}
    </div>
  )
}
