import { b2bConfig as cfg } from "./config"
import { STATUS_LABELS, type ApplicationStatus } from "./status"

// 메일 내용 (디자인 확정 전 기본 HTML. 디자이너 시안이 나오면 이 파일만 교체)

export interface MailContent {
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const layout = (body: string, footer = "") =>
  `<!doctype html><html><body style="font-family:sans-serif;line-height:1.6;color:#111">${body}` +
  `<hr><p style="font-size:12px;color:#666">주식회사 시야(SIAA Inc.) · 덕지 DUCKJI · ${esc(cfg.siteUrl)}${footer}</p></body></html>`


interface ApplicationSummary {
  id: number
  brandName: string
  eventName: string
  managerName: string
  managerPhone: string
  managerEmail: string
  plan: string
  applyKind?: string
}

const KIND_LABELS: Record<string, string> = { listing: "팝업 입점", ad: "광고", both: "팝업 입점 + 광고" }

export function applicationReceivedMail(a: ApplicationSummary): MailContent {
  return {
    subject: `[덕지] 입점 신청이 접수되었습니다 (${a.eventName})`,
    html: layout(
      `<p>${esc(a.managerName)}님, 덕지 입점·광고 신청이 접수되었습니다.</p>` +
        `<p>접수 번호: B2B-${a.id}<br>주최사/행사: ${esc(a.brandName)} / ${esc(a.eventName)}</p>` +
        `<p>검토 후 이 메일 주소로 결과를 안내드립니다.</p>`
    ),
    text: `${a.managerName}님, 덕지 입점·광고 신청이 접수되었습니다.\n접수 번호: B2B-${a.id}\n주최사/행사: ${a.brandName} / ${a.eventName}\n검토 후 결과를 안내드립니다.`,
  }
}

export function adminNoticeMail(a: ApplicationSummary): MailContent {
  return {
    subject: `[덕지 관리자] 새 입점 신청 B2B-${a.id} ${a.brandName}`,
    html: layout(
      `<p>새 입점 신청이 들어왔습니다.</p><p>${esc(a.brandName)} / ${esc(a.eventName)}<br>` +
        `담당자: ${esc(a.managerName)} (${esc(a.managerPhone)}, ${esc(a.managerEmail)})<br>신청 종류: ${esc(KIND_LABELS[a.applyKind || ""] || a.plan)}</p>` +
        `<p><a href="${esc(cfg.siteUrl)}/admin">관리자 센터에서 확인</a></p>`
    ),
    text: `새 입점 신청 B2B-${a.id}\n${a.brandName} / ${a.eventName}\n담당자: ${a.managerName} (${a.managerPhone}, ${a.managerEmail})\n신청 종류: ${KIND_LABELS[a.applyKind || ""] || a.plan}\n${cfg.siteUrl}/admin`,
  }
}

export function applicationStatusMail(a: ApplicationSummary, status: ApplicationStatus, reason: string): MailContent {
  const label = STATUS_LABELS[status]
  const guide: Partial<Record<ApplicationStatus, string>> = {
    needs_info: "아래 내용을 보완해 이 메일에 회신해 주세요.",
    approved: "신청이 승인되었습니다. 노출 위치와 기간을 확정해 다시 안내드립니다.",
    published: "덕지에 게시되었습니다.",
    rejected: "아쉽지만 이번 신청은 진행이 어렵습니다.",
  }
  const body = [guide[status] || "", reason ? `사유: ${reason}` : ""].filter(Boolean)
  return {
    subject: `[덕지] 입점 신청 B2B-${a.id} ${label} 안내`,
    html: layout(
      `<p>${esc(a.managerName)}님, ${esc(a.brandName)} / ${esc(a.eventName)} 입점 신청이 <b>${esc(label)}</b> 상태가 되었습니다.</p>` +
        body.map((l) => `<p>${esc(l).replace(/\n/g, "<br>")}</p>`).join("")
    ),
    text: `${a.managerName}님, ${a.brandName} / ${a.eventName} 입점 신청이 ${label} 상태가 되었습니다.\n${body.join("\n")}`,
  }
}

// 구독 확인·수신거부 링크를 눌렀을 때 보여줄 간단한 결과 페이지
export function resultPage(title: string, message: string) {
  return (
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)}</title></head><body style="font-family:sans-serif;max-width:480px;margin:64px auto;padding:0 16px;line-height:1.6">` +
    `<h2>${esc(title)}</h2><p>${esc(message)}</p><p><a href="${esc(cfg.siteUrl)}">덕지로 가기</a></p></body></html>`
  )
}
