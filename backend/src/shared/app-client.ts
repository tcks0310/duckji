// 앱 껍데기(웹뷰)에서 온 요청인지: 머리글 X-Duckji-Client: app 또는 UA 의 DuckjiApp (mobile/App.tsx 가 붙임)
// 머리글은 누구나 흉내 낼 수 있어서, 앱 전용 혜택은 회원별 하루 한도로 함께 막음
export const isAppRequest = (c: { req: { header: (n: string) => string | undefined } }) =>
  c.req.header("x-duckji-client") === "app" || /DuckjiApp/.test(c.req.header("user-agent") || "")
