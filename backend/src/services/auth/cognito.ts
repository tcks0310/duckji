// Cognito 사용자 풀 (이메일 가입·인증 코드·비밀번호 재설정)
// SignUp·InitiateAuth 등은 앱 클라이언트 id 만으로 부르는 공개 API 라 AWS 자격 증명·SDK 없이 호출합니다.
// 회원 정보는 Cognito 가 아니라 우리 DB(users 서비스)에 둡니다. Cognito 는 비밀번호와 이메일 인증만 맡습니다.

const region = () => process.env.COGNITO_REGION || "ap-northeast-2"
const clientId = () => process.env.COGNITO_CLIENT_ID || ""

export const isCognitoConfigured = () => Boolean(clientId())

export class CognitoError extends Error {
  constructor(
    readonly type: string,
    message: string
  ) {
    super(message)
  }
}

async function call<T = any>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://cognito-idp.${region()}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify({ ClientId: clientId(), ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const type = String(data.__type || "UnknownError").split("#").pop()!
    throw new CognitoError(type, String(data.message || data.Message || type))
  }
  return data as T
}

export const signUp = (email: string, password: string, name: string) =>
  call("SignUp", {
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: name },
    ],
  })

export const confirmSignUp = (email: string, code: string) =>
  call("ConfirmSignUp", { Username: email, ConfirmationCode: code })

export const resendCode = (email: string) => call("ResendConfirmationCode", { Username: email })

export const forgotPassword = (email: string) => call("ForgotPassword", { Username: email })

export const confirmForgotPassword = (email: string, code: string, password: string) =>
  call("ConfirmForgotPassword", { Username: email, ConfirmationCode: code, Password: password })

export interface CognitoIdentity {
  sub: string
  email: string
  emailVerified: boolean
  name?: string
}

// 비밀번호 로그인. 예전 이메일 가입 회원은 Cognito 가 users 서비스(사용자 이전 트리거)에 물어 옮겨 옵니다.
export async function passwordLogin(email: string, password: string): Promise<{ identity: CognitoIdentity; accessToken: string }> {
  const data = await call("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: email, PASSWORD: password },
  })
  const result = data.AuthenticationResult
  if (!result?.IdToken) throw new CognitoError("ChallengeRequired", data.ChallengeName || "추가 인증이 필요합니다.")
  // Cognito 에서 TLS 로 직접 받은 토큰이라 서명 검증 없이 내용만 읽음
  const payload = JSON.parse(Buffer.from(String(result.IdToken).split(".")[1], "base64url").toString("utf8"))
  return {
    identity: {
      sub: String(payload.sub),
      email: String(payload.email || email).toLowerCase(),
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
      name: typeof payload.name === "string" ? payload.name : undefined,
    },
    accessToken: String(result.AccessToken),
  }
}

// 회원 탈퇴 때 본인 비밀번호로 Cognito 계정 삭제
export const deleteUser = (accessToken: string) => call("DeleteUser", { AccessToken: accessToken })
