import * as admin from "firebase-admin";
// v2 Functions API
import { onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";

try { admin.app(); } catch { admin.initializeApp(); }
setGlobalOptions({ region: "asia-northeast3" }); // 서울 리전(원하면 변경 가능)

// 카카오 access_token → Firebase Custom Token 발급
export const authWithKakao = onCall(async (request) => {
  const accessToken = request.data?.accessToken as string | undefined;
  if (!accessToken) {
    throw new Error("accessToken required");
  }

  // 1) 카카오 사용자 조회
  const resp = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error("Invalid Kakao token: " + text);
  }
  const me: any = await resp.json();
  const kakaoId = String(me.id);
  const uid = `kakao:${kakaoId}`;

  // 2) 커스텀 토큰 발급 (필요시 표시명/이미지도 claim에 담음)
  const claims = {
    provider: "kakao",
    name: me.properties?.nickname || "",
    profileImage: me.properties?.profile_image || "",
  };
  const customToken = await admin.auth().createCustomToken(uid, claims);

  // 3) Firestore에 사용자 기본 프로필 저장/갱신
  const db = admin.firestore();
  await db.collection("users").doc(uid).set({
    uid,
    name: me.properties?.nickname || "",
    profileImage: me.properties?.profile_image || "",
    provider: "kakao",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { customToken };
});

// (선택) 관리자 권한 부여용 함수 — 최초 1회만 쓰고 나중에 막으세요.
export const setAdmin = onCall(async (request) => {
  const targetUid = request.data?.uid as string;
  const isAdmin = !!request.data?.isAdmin;
  if (!targetUid) throw new Error("uid required");

  await admin.auth().setCustomUserClaims(targetUid, { admin: isAdmin });
  return { ok: true };
});
