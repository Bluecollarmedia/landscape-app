import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage, useT } from '@/i18n';
import { useWeather } from '@/hooks/useWeather';
import { readTown, saveTown } from '@/data/weather';
import { DEFAULT_TOWN, WEATHER_TOWNS, townName, type TownKey } from '@/lib/weatherTowns';
import { ageMinutes, degrees, hourLabel, snowKind, timeLabel, weekdayShort, todayInTowns, type WxAlert, type WxDay } from '@/lib/weatherView';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Floaty, GlassCard, WxPicture } from '@/components/weather/WeatherUI';

const WHITE = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.86)';

export default function WeatherHome() {
  const t = useT();
  const { language } = useLanguage();
  const locale = language === 'es' ? 'es' : 'en-US';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [town, setTown] = useState<TownKey>(DEFAULT_TOWN);
  const [pickTown, setPickTown] = useState(false);
  const [openAlert, setOpenAlert] = useState<WxAlert | null>(null);
  const { view, refresh, busy } = useWeather(town);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { readTown().then(setTown); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  const data = view.data;
  const name = townName(town);
  const today = todayInTowns(now);
  const stale = view.status === 'stale' && !busy;

  function snowText(d: WxDay): { text: string; color: string } {
    const k = snowKind(d.snowIn);
    if (k === 'unavailable') return { text: t('Snow: unavailable'), color: 'rgba(255,255,255,0.65)' };
    if (k === 'none') return { text: t('Snow: none'), color: 'rgba(255,255,255,0.8)' };
    if (k === 'trace') return { text: t('Snow: trace'), color: '#BFE0FF' };
    return { text: t('Snow: {n} in', { n: d.snowIn as number }), color: '#BFE0FF' };
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: insets.bottom + 130 }}>
        <View style={styles.top}>
          <View style={styles.brand}>
            <Image source={require('../../assets/images/logo-leaf.png')} style={styles.leaf} />
            <View>
              <Text style={styles.brandName}>BRIGHTON</Text>
              <Text style={styles.brandSub}>LAWN · LANDSCAPE</Text>
            </View>
          </View>
          <Floaty delay={900}>
            <Pressable onPress={() => router.push('/(auth)/welcome' as any)} accessibilityRole="button" accessibilityLabel={t('Sign In')}>
              <GlassCard style={styles.signIn}>
                <View style={styles.signInRow}>
                  <Text style={styles.signInText}>{t('Sign In')}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={15} color={WHITE} />
                </View>
              </GlassCard>
            </Pressable>
          </Floaty>
        </View>

        <Pressable onPress={() => setPickTown(true)} style={styles.townRow} accessibilityRole="button" accessibilityLabel={t('Choose your town')}>
          <MaterialCommunityIcons name="map-marker-outline" size={16} color={WHITE} />
          <Text style={styles.townText}>{name}, New Jersey</Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={WHITE} />
        </Pressable>

        {data?.current ? (
          <View>
            <Text style={styles.temp}>{degrees(data.current.tempF)}</Text>
            <Text style={styles.cond}>{data.current.text}</Text>
            <Text style={styles.hl}>{t('H: {high}  L: {low}', { high: degrees(data.today.highF), low: degrees(data.today.lowF) })}</Text>
          </View>
        ) : view.status === 'loading' ? (
          <Text style={styles.cond}>{t('Loading the forecast…')}</Text>
        ) : (
          <Text style={styles.bigMsg}>{t('Weather is unavailable right now')}</Text>
        )}

        {stale && data ? (
          <Floaty delay={300}>
            <GlassCard style={styles.card}>
              <View style={styles.pad}>
                <Text style={styles.cardTitle}>{t('Last forecast, {n} minutes ago', { n: ageMinutes(data.fetchedAt, now) })}</Text>
                <Text style={styles.cardBody}>{t("We couldn't reach the National Weather Service. This is the last forecast we have for {town}, so it may be out of date.", { town: name })}</Text>
                <Pressable onPress={refresh} style={styles.retry} accessibilityRole="button"><Text style={styles.retryText}>{t('Try again')}</Text></Pressable>
              </View>
            </GlassCard>
          </Floaty>
        ) : null}

        {view.status === 'unavailable' ? (
          <Floaty delay={300}>
            <GlassCard style={styles.card}>
              <View style={styles.pad}>
                <Text style={styles.cardBody}>{t('No forecast is available for {town} right now. Try again in a few minutes.', { town: name })}</Text>
                <Pressable onPress={refresh} style={styles.retry} accessibilityRole="button"><Text style={styles.retryText}>{t('Try again')}</Text></Pressable>
              </View>
            </GlassCard>
          </Floaty>
        ) : null}

        {data && data.alerts.length > 0 ? (
          <View style={{ marginTop: 14, gap: 10 }}>
            {data.alerts.map((a) => (
              <Floaty key={a.id} delay={500}>
                <Pressable onPress={() => setOpenAlert(a)} accessibilityRole="button" accessibilityLabel={a.event}>
                  <GlassCard style={styles.alert}>
                    <View style={styles.alertRow}>
                      <MaterialCommunityIcons name="alert-outline" size={22} color="#FFD27A" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertTitle}>{a.event}</Text>
                        <Text style={styles.alertSub}>{a.sender}{a.expires ? ` · ${t('Until {time}', { time: timeLabel(a.expires, locale) })}` : ''}</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={SOFT} />
                    </View>
                  </GlassCard>
                </Pressable>
              </Floaty>
            ))}
          </View>
        ) : null}

        {data && data.hourly.length > 0 ? (
          <Floaty delay={1200} style={{ marginTop: 14 }}>
            <GlassCard style={styles.card}>
              <View style={styles.pad}>
                <Text style={styles.cardTitle}>{t('Hourly Forecast')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} contentContainerStyle={{ gap: 18, paddingTop: 10, paddingRight: 6 }}>
                  {data.hourly.map((h, i) => (
                    <View key={h.time} style={styles.hour}>
                      <Text style={styles.hourText}>{i === 0 ? t('Now') : hourLabel(h.time, locale)}</Text>
                      <WxPicture icon={h.icon} size={26} />
                      <Text style={styles.hourTemp}>{degrees(h.tempF)}</Text>
                      {typeof h.popPct === 'number' && h.popPct >= 10 ? <Text style={styles.pop}>{h.popPct}%</Text> : <Text style={styles.pop}> </Text>}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </GlassCard>
          </Floaty>
        ) : null}

        {data && data.daily.length > 0 ? (
          <Floaty delay={2000} style={{ marginTop: 14 }}>
            <GlassCard style={styles.card}>
              <View style={styles.pad}>
                <Text style={styles.cardTitle}>{t('7 Day Forecast')}</Text>
                {data.daily.map((d, i) => {
                  const s = snowText(d);
                  return (
                    <View key={d.date} style={[styles.day, i > 0 && styles.dayLine]}>
                      <Text style={styles.dayName}>{d.date === today ? t('Today') : weekdayShort(d.date, locale)}</Text>
                      <WxPicture icon={d.icon} size={22} />
                      <Text style={styles.dayPop}>{typeof d.popPct === 'number' ? `${d.popPct}%` : ''}</Text>
                      <Text style={[styles.daySnow, { color: s.color }]} numberOfLines={1}>{s.text}</Text>
                      <Text style={styles.dayTemps}>{degrees(d.highF)} / {degrees(d.lowF)}</Text>
                    </View>
                  );
                })}
              </View>
            </GlassCard>
          </Floaty>
        ) : null}

        {data ? (
          <Text style={styles.foot}>
            {t('Forecast data: National Weather Service')}
            {'\n'}
            {ageMinutes(data.fetchedAt, now) < 1 ? t('Updated just now') : t('Updated {n} min ago', { n: ageMinutes(data.fetchedAt, now) })}
          </Text>
        ) : null}
      </ScrollView>

      <BottomSheetModal visible={pickTown} onRequestClose={() => setPickTown(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickTown(false)} accessibilityLabel={t('Close')} />
          <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.grip} />
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>{t('Choose your town')}</Text>
                <Pressable onPress={() => setPickTown(false)} hitSlop={10}><Text style={styles.sheetCancel}>{t('Cancel')}</Text></Pressable>
              </View>
              <Text style={styles.sheetNote}>{t('Weather is shown for the town you pick. No location access is needed.')}</Text>
              {WEATHER_TOWNS.map((x) => (
                <Pressable key={x.key} onPress={() => { setTown(x.key); void saveTown(x.key); setPickTown(false); }} style={styles.townItem} accessibilityRole="button">
                  <Text style={styles.townItemText}>{x.name}</Text>
                  {x.key === town ? <MaterialCommunityIcons name="check" size={20} color="#1F4D36" /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </BottomSheetModal>

      <BottomSheetModal visible={!!openAlert} onRequestClose={() => setOpenAlert(null)}>
        <View style={{ flex: 1 }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenAlert(null)} accessibilityLabel={t('Close')} />
          <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: '85%' }]}>
              <View style={styles.grip} />
              <View style={styles.sheetHead}>
                <Text style={[styles.sheetTitle, { flex: 1 }]}>{openAlert?.event}</Text>
                <Pressable onPress={() => setOpenAlert(null)} hitSlop={10}><Text style={styles.sheetCancel}>{t('Close')}</Text></Pressable>
              </View>
              <ScrollView bounces={false}>
                <Text style={styles.alertSender}>{openAlert?.sender}</Text>
                {openAlert?.headline ? <Text style={styles.alertHeadline}>{openAlert.headline}</Text> : null}
                {openAlert?.description ? <Text style={styles.alertBody}>{openAlert.description}</Text> : null}
                {openAlert?.instruction ? <Text style={styles.alertBody}>{openAlert.instruction}</Text> : null}
              </ScrollView>
            </View>
          </View>
        </View>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leaf: { width: 28, height: 28, tintColor: WHITE },
  brandName: { color: WHITE, fontSize: 16, fontWeight: '600', letterSpacing: 2.6 },
  brandSub: { color: SOFT, fontSize: 7.5, letterSpacing: 2.2, marginTop: 3 },
  signIn: { borderRadius: 99 },
  signInRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 15 },
  signInText: { color: WHITE, fontSize: 13, fontWeight: '600' },
  townRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 26 },
  townText: { color: WHITE, fontSize: 14 },
  temp: { color: WHITE, fontSize: 96, fontWeight: '200', letterSpacing: -4, marginTop: 4, lineHeight: 104 },
  cond: { color: WHITE, fontSize: 19, marginTop: 2 },
  hl: { color: SOFT, fontSize: 13, marginTop: 2 },
  bigMsg: { color: WHITE, fontSize: 24, fontWeight: '500', marginTop: 12 },
  card: { borderRadius: 22 },
  pad: { padding: 14 },
  cardTitle: { color: WHITE, fontSize: 13, fontWeight: '700' },
  cardBody: { color: SOFT, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  retry: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 7, paddingHorizontal: 15, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.22)' },
  retryText: { color: WHITE, fontSize: 13, fontWeight: '600' },
  alert: { borderRadius: 18 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  alertTitle: { color: WHITE, fontSize: 14, fontWeight: '700' },
  alertSub: { color: SOFT, fontSize: 12, marginTop: 1 },
  hour: { alignItems: 'center', gap: 5, minWidth: 40 },
  hourText: { color: SOFT, fontSize: 11.5 },
  hourTemp: { color: WHITE, fontSize: 14, fontWeight: '600' },
  pop: { color: '#BFE0FF', fontSize: 10.5 },
  day: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 8 },
  dayLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.3)' },
  dayName: { color: WHITE, fontSize: 13.5, width: 46 },
  dayPop: { color: SOFT, fontSize: 12, width: 38 },
  daySnow: { flex: 1, fontSize: 12 },
  dayTemps: { color: WHITE, fontSize: 13.5, fontWeight: '500' },
  foot: { color: SOFT, fontSize: 11, textAlign: 'center', marginTop: 18, lineHeight: 16 },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10 },
  grip: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D9D7CE', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: '#26332B', fontSize: 18, fontWeight: '600' },
  sheetCancel: { color: '#5C6A61', fontSize: 14 },
  sheetNote: { color: '#5C6A61', fontSize: 12.5, marginTop: 8, marginBottom: 6 },
  townItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7E5DC' },
  townItemText: { color: '#26332B', fontSize: 16 },
  alertSender: { color: '#5C6A61', fontSize: 13, marginTop: 8 },
  alertHeadline: { color: '#26332B', fontSize: 15, fontWeight: '600', marginTop: 10 },
  alertBody: { color: '#3D4A42', fontSize: 14, lineHeight: 21, marginTop: 10 },
});
