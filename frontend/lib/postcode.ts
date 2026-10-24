// 주소 검색 (카카오 우편번호 서비스, 키 없이 무료). 우편번호·기본 주소를 채우고 상세 주소만 직접 입력
// https://postcode.map.daum.net/guide

const SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"

export type PostcodeResult = { zonecode: string; address: string }

let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  const w = window as any
  if (w.daum?.Postcode) return Promise.resolve()
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script")
      s.src = SCRIPT_URL
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        loading = null
        reject(new Error("주소 검색을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."))
      }
      document.head.appendChild(s)
    })
  }
  return loading
}

// 도로명 주소 기준(건물 이름이 있으면 괄호로 덧붙임). 지번을 고르면 지번 주소
export async function searchAddress(): Promise<PostcodeResult | null> {
  await loadScript()
  const w = window as any
  return new Promise((resolve) => {
    let done = false
    new w.daum.Postcode({
      oncomplete: (d: any) => {
        done = true
        let address: string = d.userSelectedType === "J" ? d.jibunAddress || d.address : d.roadAddress || d.address
        if (d.userSelectedType !== "J" && d.buildingName && d.apartment === "Y") address += ` (${d.buildingName})`
        resolve({ zonecode: d.zonecode, address })
      },
      onclose: () => {
        if (!done) resolve(null)
      },
    }).open({ popupTitle: "주소 검색" })
  })
}
