import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { haptics } from '@/lib/haptics';
import { ScrubArea } from '@/components/weather/ScrubArea';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage, useT } from '@/i18n';
import { hoursOnDate, hourLabel, orDash, tempColor, weekdayShort, todayInTowns, type WeatherPayload, type WxHour } from '@/lib/weatherView';
import { Panel, WX, WeatherBackground, WxPicture } from '@/components/weather/WeatherUI';

export type MetricKey = 'temp' | 'feels' | 'pop' | 'rain' | 'wind' | 'gust' | 'humidity' | 'dew' | 'cloud';
type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
interface Metric { key: MetricKey; label: string; icon: Icon; kind: 'line' | 'bars'; get: (h: WxHour) => number | null; fmt: (v: number | null, h?: WxHour) => string; max?: number }

const METRICS: Metric[] = [
  { key: 'temp', label: 'Temperature', icon: 'thermometer', kind: 'line', get: (h) => h.tempF, fmt: (v) => orDash(v, '°') },
  { key: 'feels', label: 'Feels like', icon: 'thermometer-lines', kind: 'line', get: (h) => h.feelsF, fmt: (v) => orDash(v, '°') },
  { key: 'pop', label: 'Rain chance', icon: 'weather-pouring', kind: 'bars', max: 100, get: (h) => h.popPct, fmt: (v) => orDash(v, '%') },
  { key: 'rain', label: 'Rain amount', icon: 'water-outline', kind: 'bars', get: (h) => h.precipIn, fmt: (v) => orDash(v, ' in', 2) },
  { key: 'wind', label: 'Wind', icon: 'weather-windy', kind: 'line', get: (h) => h.windMph, fmt: (v, h) => (v === null ? '–' : `${Math.round(v)} mph ${h?.windDir ?? ''}`.trim()) },
  { key: 'gust', label: 'Wind gusts', icon: 'weather-windy-variant', kind: 'line', get: (h) => h.gustMph, fmt: (v) => orDash(v, ' mph') },
  { key: 'humidity', label: 'Humidity', icon: 'water-percent', kind: 'line', get: (h) => h.humidityPct, fmt: (v) => orDash(v, '%') },
  { key: 'dew', label: 'Dew point', icon: 'water-thermometer-outline', kind: 'line', get: (h) => h.dewF, fmt: (v) => orDash(v, '°') },
  { key: 'cloud', label: 'Cloud cover', icon: 'cloud-outline', kind: 'bars', max: 100, get: (h) => h.cloudPct, fmt: (v) => orDash(v, '%') },
];

const INK = WX.deep;
const SOFT = WX.soft;
const ON_DARK = '#FFFFFF';
const AXIS_W = 40;
const CHART_H = 190;

const hourOf = (iso: string): number => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' }).format(new Date(iso)));
const dayTitle = (date: string, locale: string): string => new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

export interface DetailsStart { date: string; time?: string; metric?: MetricKey }

/**
 * The details screen: pick a day, pick a figure, then drag across the chart (or tap, or use the arrows) to read it hour by hour.
 * It opens as a sheet over the weather home, so closing it brings the person back to exactly where they were.
 */
export function WeatherDetails({ visible, data, start, onClose }: { visible: boolean; data: WeatherPayload | null; start: DetailsStart | null; onClose: () => void }) {
  const t = useT();
  const { language } = useLanguage();
  const locale = language === 'es' ? 'es' : 'en-US';
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState('');
  const [idx, setIdx] = useState(0);
  const [metricKey, setMetricKey] = useState<MetricKey>('temp');
  const [width, setWidth] = useState(0);

  const days = data?.daily ?? [];
  const hours = useMemo(() => (data && date ? hoursOnDate(data.hourly, date) : []), [data, date]);
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  // When the sheet opens, land on the day (and hour) that was tapped.
  useEffect(() => {
    if (!visible || !data || !start) return;
    const hs = hoursOnDate(data.hourly, start.date);
    let i = start.time ? hs.findIndex((h) => h.time === start.time) : -1;
    if (i < 0) i = start.date === todayInTowns(Date.now()) ? 0 : Math.max(0, hs.findIndex((h) => hourOf(h.time) >= 12));
    setDate(start.date);
    setIdx(Math.max(0, i));
    setMetricKey(start.metric ?? 'temp');
  }, [visible, data, start]);

  const selected: WxHour | undefined = hours[Math.min(idx, hours.length - 1)];
  const values = hours.map((h) => metric.get(h));
  const known = values.filter((v): v is number => v !== null);

  // Chart scale.
  const plotW = Math.max(0, width - AXIS_W);
  const bars = metric.kind === 'bars';
  let lo = 0; let hi = 1;
  if (known.length) {
    if (bars) { lo = 0; hi = metric.max ?? Math.max(0.1, Math.max(...known)); }
    else {
      lo = Math.floor(Math.min(...known) - 1); hi = Math.ceil(Math.max(...known) + 1);
      if (hi - lo < 6) { const mid = (hi + lo) / 2; lo = Math.floor(mid - 3); hi = Math.ceil(mid + 3); }
    }
  }
  const xAt = (i: number) => (hours.length <= 1 ? plotW / 2 : (i / (hours.length - 1)) * plotW);
  const yAt = (v: number) => CHART_H - ((v - lo) / (hi - lo || 1)) * CHART_H;

  // Sliding a finger across the chart picks the hour under it, live, with a light tick as it crosses each hour. A tap does the same, and the
  // arrows below do it too, so sliding is only ever a shortcut.
  const lastPick = useRef(-1);
  const pickHour = useCallback((i: number) => {
    if (i !== lastPick.current) { lastPick.current = i; haptics.select(); }
    setIdx(i);
  }, []);
  const endScrub = useCallback(() => { lastPick.current = -1; }, []);

  const stat = (() => {
    if (!known.length) return t('Unavailable');
    if (metric.key === 'rain') return t('{n} in for the day', { n: known.reduce((a, b) => a + b, 0).toFixed(2) });
    const hiV = Math.max(...known); const loV = Math.min(...known);
    const hiH = hours[values.indexOf(hiV)]; const loH = hours[values.indexOf(loV)];
    if (bars) return t('Highest {v} around {time}', { v: metric.fmt(hiV, hiH), time: hourLabel(hiH.time, locale) });
    return t('High {high} at {hi} · Low {low} at {lo}', { high: metric.fmt(hiV, hiH), hi: hourLabel(hiH.time, locale), low: metric.fmt(loV, loH), lo: hourLabel(loH.time, locale) });
  })();

  const axisLabels = hours.map((h, i) => ({ h, i })).filter(({ h }) => [0, 6, 12, 18].includes(hourOf(h.time)));
  const grid = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);

  const segs: React.ReactNode[] = [];
  if (!bars) {
    for (let i = 0; i < hours.length - 1; i++) {
      const a = values[i]; const b = values[i + 1];
      if (a === null || b === null) continue;
      const x1 = xAt(i); const y1 = yAt(a); const x2 = xAt(i + 1); const y2 = yAt(b);
      const len = Math.hypot(x2 - x1, y2 - y1);
      segs.push(<View key={`s${i}`} style={{ position: 'absolute', left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 1.5, width: len, height: 3, borderRadius: 2, backgroundColor: metric.key === 'temp' ? tempColor(b) : WX.rain, transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }] }} />);
    }
  }

  const sel = selected;
  const selVal = sel ? metric.get(sel) : null;
  const go = (d: number) => setIdx((i) => Math.max(0, Math.min(hours.length - 1, i + d)));
  const hasHours = hours.length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: WX.page }}>
        <WeatherBackground />
        <ScrollView contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close details')} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]} hitSlop={6}>
              <View style={styles.backGlass}>
                <View style={styles.backRow}>
                  <MaterialCommunityIcons name="chevron-left" size={22} color={INK} />
                  <Text style={styles.backText}>{t('Back')}</Text>
                </View>
              </View>
            </Pressable>
            <View style={styles.headTitle} pointerEvents="none">
              <Text style={styles.title}>{t('Details')}</Text>
              <Text style={styles.subtitle}>{data?.townName}</Text>
            </View>
          </View>

          <View style={styles.days}>
            {days.map((d) => {
              const on = d.date === date;
              const empty = !data || hoursOnDate(data.hourly, d.date).length === 0;
              return (
                <Pressable
                  key={d.date}
                  disabled={empty}
                  onPress={() => { setDate(d.date); const hs = data ? hoursOnDate(data.hourly, d.date) : []; setIdx(d.date === todayInTowns(Date.now()) ? 0 : Math.max(0, hs.findIndex((h) => hourOf(h.time) >= 12))); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: empty }}
                  accessibilityLabel={dayTitle(d.date, locale)}
                  style={({ pressed }) => [styles.day, on && styles.dayOn, empty && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.dayText, on && { fontWeight: '700', color: ON_DARK }]}>{weekdayShort(d.date, locale)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Panel style={{ marginTop: 14 }}>
            <View style={styles.pad}>
              <Text style={styles.chartTitle}>{t(metric.label)} · {date ? dayTitle(date, locale) : ''}</Text>
              <Text style={styles.chartStat}>{stat}</Text>

              {hasHours && sel ? (
                <View style={styles.readout} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${t(metric.label)}, ${metric.fmt(selVal, sel)}, ${hourLabel(sel.time, locale)}`}>
                  <WxPicture icon={sel.icon} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.readValue}>{selVal === null ? t('Unavailable') : metric.fmt(selVal, sel)}</Text>
                    <Text style={styles.readTime}>{hourLabel(sel.time, locale)} · {dayTitle(date, locale)}</Text>
                  </View>
                  <Pressable onPress={() => go(-1)} disabled={idx <= 0} accessibilityRole="button" accessibilityLabel={t('Previous hour')} style={({ pressed }) => [styles.step, idx <= 0 && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}>
                    <MaterialCommunityIcons name="chevron-left" size={26} color={INK} />
                  </Pressable>
                  <Pressable onPress={() => go(1)} disabled={idx >= hours.length - 1} accessibilityRole="button" accessibilityLabel={t('Next hour')} style={({ pressed }) => [styles.step, idx >= hours.length - 1 && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}>
                    <MaterialCommunityIcons name="chevron-right" size={26} color={INK} />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.empty}>{t('No hourly figures for this day yet.')}</Text>
              )}

              {hasHours ? (
                <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ marginTop: 10 }}>
                  {width > 0 ? (
                    <View style={{ height: CHART_H + 26 }}>
                      <View style={{ height: CHART_H, width: plotW }} accessible={false}>
                        {grid.map((g, k) => <View key={k} style={{ position: 'absolute', left: 0, right: 0, top: yAt(g) - 0.5, height: StyleSheet.hairlineWidth, backgroundColor: WX.line }} />)}
                        {bars ? hours.map((h, i) => {
                          const v = values[i]; if (v === null) return null;
                          const bw = Math.max(3, plotW / hours.length - 2);
                          const top = Math.min(CHART_H - 2, yAt(v));
                          return <View key={h.time} style={{ position: 'absolute', left: xAt(i) - bw / 2, width: bw, top, height: CHART_H - top, borderRadius: 3, backgroundColor: i === idx ? WX.deep : '#8EC3F0', opacity: i === idx ? 1 : 0.85 }} />;
                        }) : segs}
                        {!bars ? hours.map((h, i) => {
                          const v = values[i]; if (v === null || i === idx) return null;
                          return <View key={h.time} style={{ position: 'absolute', left: xAt(i) - 3, top: yAt(v) - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: metric.key === 'temp' ? tempColor(v) : WX.rain, borderWidth: 1.5, borderColor: '#FFFFFF' }} />;
                        }) : null}
                        {sel ? <View style={{ position: 'absolute', left: xAt(idx) - 1, top: 0, width: 2, height: CHART_H, backgroundColor: WX.deep }} /> : null}
                        {sel && selVal !== null && !bars ? <View style={{ position: 'absolute', left: xAt(idx) - 7, top: yAt(selVal) - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: metric.key === 'temp' ? tempColor(selVal) : WX.rain }} /> : null}
                      </View>
                      <ScrubArea width={plotW} count={hours.length} onPick={pickHour} onEnd={endScrub} style={{ position: 'absolute', left: 0, top: 0, width: plotW, height: CHART_H }} />
                      {grid.map((g, k) => <Text key={k} style={[styles.axisY, { top: yAt(g) - 8 }]}>{metric.fmt(g, undefined).replace(/ mph.*/, '')}</Text>)}
                      {axisLabels.map(({ h, i }) => <Text key={h.time} style={[styles.axisX, { left: Math.max(0, Math.min(plotW - 40, xAt(i) - 20)), top: CHART_H + 6 }]}>{hourLabel(h.time, locale)}</Text>)}
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.hint}>{t('Slide your finger across the chart, or use the arrows, to move hour by hour.')}</Text>
            </View>
          </Panel>

          <Text style={styles.section}>{t('Choose what to see')}</Text>
          <View style={styles.grid}>
            {METRICS.map((m) => {
              const on = m.key === metricKey;
              const v = sel ? m.get(sel) : null;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMetricKey(m.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${t(m.label)}, ${v === null ? t('Unavailable') : m.fmt(v, sel)}`}
                  style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.75 }]}
                >
                  <View style={styles.tileHead}>
                    <MaterialCommunityIcons name={m.icon} size={16} color={on ? ON_DARK : SOFT} />
                    <Text style={[styles.tileLabel, on && { color: ON_DARK }]} numberOfLines={1}>{t(m.label)}</Text>
                  </View>
                  <Text style={[styles.tileValue, on && { color: ON_DARK }, v === null && styles.tileOff, v === null && on && { color: '#D7E8DD' }]} numberOfLines={1}>{v === null ? t('Unavailable') : m.fmt(v, sel)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.source}>{t('Forecast data: National Weather Service')}</Text>
        </ScrollView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { height: 52, justifyContent: 'center' },
  back: { alignSelf: 'flex-start', zIndex: 2 },
  backGlass: { borderRadius: 99, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: WX.line, shadowColor: '#14803C', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  backRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 8, paddingRight: 16 },
  backText: { color: INK, fontSize: 16, fontWeight: '700' },
  headTitle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  title: { color: INK, fontSize: 17, fontWeight: '700' },
  subtitle: { color: SOFT, fontSize: 12.5 },
  days: { flexDirection: 'row', gap: 6, marginTop: 6 },
  day: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: WX.line },
  dayOn: { backgroundColor: WX.deep, borderColor: WX.deep },
  dayText: { color: INK, fontSize: 13 },
  pad: { padding: 16 },
  chartTitle: { color: INK, fontSize: 15, fontWeight: '700' },
  chartStat: { color: SOFT, fontSize: 13, marginTop: 3, lineHeight: 18 },
  readout: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 10, borderRadius: 16, backgroundColor: WX.leafTint },
  readValue: { color: INK, fontSize: 24, fontWeight: '700' },
  readTime: { color: SOFT, fontSize: 12.5, marginTop: 1 },
  step: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: WX.line },
  empty: { color: SOFT, fontSize: 13.5, marginTop: 14 },
  axisY: { position: 'absolute', right: 0, width: AXIS_W - 4, textAlign: 'right', color: SOFT, fontSize: 11 },
  axisX: { position: 'absolute', width: 40, textAlign: 'center', color: SOFT, fontSize: 11 },
  hint: { color: WX.faint, fontSize: 12, marginTop: 10 },
  section: { color: INK, fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.5%', minHeight: 74, borderRadius: 18, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: WX.line, justifyContent: 'space-between' },
  tileOn: { backgroundColor: WX.deep, borderColor: WX.deep },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { color: SOFT, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  tileValue: { color: INK, fontSize: 21, fontWeight: '700', marginTop: 6 },
  tileOff: { fontSize: 14, fontWeight: '500', color: WX.faint },
  source: { color: WX.faint, fontSize: 11, textAlign: 'center', marginTop: 20 },
});
