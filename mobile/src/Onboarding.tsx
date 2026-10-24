import { useRef, useState, type ComponentRef } from "react"
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"
import { COLORS } from "./config"

// 처음 열 때 한 번: 소개 3장 → 알림 허용 안내 (시안 launch/mobile-app-mockup/1-처음-열때.png)
// 로그인은 따로 화면을 만들지 않고 마이 탭의 웹 로그인을 씀

type Slide = { image: ImageSourcePropType; badgeTop: string; badgeBottom: string; title: string; accent: string; body: string }

const SLIDES: Slide[] = [
  {
    image: require("../assets/intro-duckji.png"),
    badgeTop: "📍 성수 · 팝업 3곳",
    badgeBottom: "D-1 오픈 알림",
    title: "지금 뜨는 팝업을",
    accent: "한눈에",
    body: "애니·게임 팝업스토어와 콜라보 카페를\n일정과 지도로 모아 봤어요",
  },
  {
    image: require("../assets/intro-ducksoon.png"),
    badgeTop: "🐾 덕지순례 코스",
    badgeBottom: "도장 3/5",
    title: "덕지순례로",
    accent: "성지를 걸어요",
    body: "작품 속 장소를 코스로 따라 걷고\n도착하면 도장과 DP 를 받아요",
  },
  {
    image: require("../assets/intro-clow.png"),
    badgeTop: "🛍 굿즈샵 랭킹",
    badgeBottom: "펀딩 120% 달성",
    title: "굿즈와 펀딩도",
    accent: "덕지에서",
    body: "덕후들이 고른 굿즈를 사고\n갖고 싶은 굿즈는 펀딩으로 만들어요",
  },
]

const PERKS: [keyof typeof Feather.glyphMap, string][] = [
  ["map-pin", "찜한 팝업이 내일 시작해요"],
  ["truck", "주문한 굿즈가 출발했어요"],
  ["check-circle", "예약한 날이 다가와요"],
  ["gift", "펀딩이 목표를 달성했어요"],
]

export function Onboarding({ onAllowPush, onDone }: { onAllowPush: () => Promise<void>; onDone: () => void }) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [page, setPage] = useState(0)
  const [asking, setAsking] = useState(false)
  const pager = useRef<ComponentRef<typeof ScrollView>>(null)
  const onPermission = page >= SLIDES.length

  const go = (n: number) => {
    setPage(n)
    pager.current?.scrollTo({ x: n * width, animated: true })
  }

  const allow = async () => {
    setAsking(true)
    try {
      await onAllowPush()
    } finally {
      setAsking(false)
      onDone()
    }
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      {!onPermission && (
        <Pressable onPress={() => go(SLIDES.length)} style={styles.skip} hitSlop={12}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      )}

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.flex}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.art}>
              <View style={styles.glow} />
              <Image source={s.image} style={styles.character} resizeMode="contain" />
              <View style={[styles.badge, styles.badgeTop]}>
                <Text style={styles.badgeText}>{s.badgeTop}</Text>
              </View>
              <View style={[styles.badge, styles.badgeBottom]}>
                <Text style={styles.badgeText}>{s.badgeBottom}</Text>
              </View>
            </View>
            <Text style={styles.title}>
              {s.title}
              {"\n"}
              <Text style={styles.accent}>{s.accent}</Text>
            </Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}

        <View style={[styles.slide, { width }]}>
          <View style={styles.bell}>
            <Feather name="bell" size={52} color={COLORS.gold} />
          </View>
          <Text style={[styles.title, styles.permTitle]}>찜한 팝업 소식을{"\n"}놓치지 마세요</Text>
          <Text style={styles.body}>알림을 켜면 이런 소식을 보내 드려요</Text>
          <View style={styles.perks}>
            {PERKS.map(([icon, text]) => (
              <View key={text} style={styles.perk}>
                <Feather name={icon} size={19} color={COLORS.gold} />
                <Text style={styles.perkText}>{text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.fine}>밤 9시~아침 8시엔 주문·예약 안내만 보내요 · 알림 설정에서 언제든 바꿀 수 있어요</Text>
        </View>
      </ScrollView>

      {!onPermission ? (
        <>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
          <Pressable onPress={() => go(page + 1)} style={styles.primary}>
            <Text style={styles.primaryText}>다음</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable onPress={allow} disabled={asking} style={[styles.primary, asking && styles.dim]}>
            <Text style={styles.primaryText}>알림 받기</Text>
          </Pressable>
          <Pressable onPress={onDone} style={styles.later} hitSlop={8}>
            <Text style={styles.laterText}>나중에 할게요</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: COLORS.wine, zIndex: 10 },
  flex: { flex: 1 },
  skip: { position: "absolute", right: 22, top: 0, marginTop: 52, zIndex: 2 },
  skipText: { fontSize: 14, color: COLORS.muted },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  art: { width: "100%", height: 320, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(242,182,54,0.16)" },
  character: { height: 270, width: 230 },
  badge: { position: "absolute", paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "rgba(58,10,20,0.85)", borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line },
  badgeTop: { left: 0, top: 26 },
  badgeBottom: { right: 0, bottom: 36 },
  badgeText: { fontSize: 12, color: COLORS.cream },
  title: { marginTop: 30, fontSize: 26, fontWeight: "900", lineHeight: 35, color: COLORS.cream, textAlign: "center" },
  permTitle: { fontSize: 24, lineHeight: 33 },
  accent: { color: COLORS.gold },
  body: { marginTop: 12, fontSize: 15, lineHeight: 23, color: COLORS.muted, textAlign: "center" },
  bell: { width: 110, height: 110, borderRadius: 32, backgroundColor: "rgba(242,182,54,0.15)", alignItems: "center", justifyContent: "center" },
  perks: { alignSelf: "stretch", marginTop: 24, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16, backgroundColor: "rgba(58,10,20,0.55)", borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line },
  perk: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  perkText: { fontSize: 15, color: COLORS.cream },
  fine: { marginTop: 14, fontSize: 12, lineHeight: 18, color: COLORS.muted, textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 22 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.tabOff },
  dotOn: { width: 22, backgroundColor: COLORS.gold },
  primary: { marginHorizontal: 24, height: 52, borderRadius: 14, backgroundColor: COLORS.gold, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 16, fontWeight: "800", color: COLORS.deep },
  dim: { opacity: 0.6 },
  later: { alignSelf: "center", paddingVertical: 14, marginTop: 4 },
  laterText: { fontSize: 15, color: COLORS.muted },
})
