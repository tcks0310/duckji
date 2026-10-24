import { AdminDeleteUserCommand, CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider"

// 이메일 로그인 계정(Cognito) 관리: 관리자 탈퇴 처리 때 삭제, Cognito 에서 직접 지운 계정을 회원 목록과 대조
// 회원 DB 는 users 서비스(VPC 안, 인터넷 없음)에 있어서, Cognito 호출은 VPC 밖인 admin 서비스가 맡고 화면이 둘을 이어 줌
// 우리 사용자 풀은 이메일을 로그인 이름으로 써서 실제 사용자 이름(Username) = sub (회원 id 는 cognito-<sub>)
const poolId = () => process.env.COGNITO_USER_POOL_ID || ""
export const isCognitoAdminConfigured = () => Boolean(poolId())

let client: CognitoIdentityProviderClient | null = null
const cognito = () => (client ??= new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-northeast-2" }))

// 사용자 풀에 있는 모든 계정의 sub
export async function listCognitoSubs(): Promise<string[]> {
  const subs: string[] = []
  let token: string | undefined
  do {
    const res = await cognito().send(new ListUsersCommand({ UserPoolId: poolId(), AttributesToGet: ["sub"], Limit: 60, PaginationToken: token }))
    for (const u of res.Users || []) {
      const sub = u.Attributes?.find((a) => a.Name === "sub")?.Value || u.Username
      if (sub) subs.push(sub)
    }
    token = res.PaginationToken
  } while (token)
  return subs
}

// 계정 삭제. 이미 없으면 지운 것으로 봄
export async function deleteCognitoUser(sub: string): Promise<void> {
  try {
    await cognito().send(new AdminDeleteUserCommand({ UserPoolId: poolId(), Username: sub }))
  } catch (e: any) {
    if (e?.name !== "UserNotFoundException") throw e
  }
}
