/**
 * Snow notification settings (supabase/updates/031).
 *
 *  • CustomerNotifyPrefs: a customer's arrival / completion alerts for each of
 *    their properties. Saved per property, so they carry over to every storm.
 *  • OwnerPropertyNotifications: the owner sees a property's current
 *    preferences and what actually happened to its recent notifications.
 *  • OwnerStopAlertsToggle: the owner's own "alert me when a stop is done"
 *    switch. Independent of customer preferences; turning it off never stops
 *    the visit, dashboard or activity log from recording the work.
 *
 * Delivery wording comes from describeDelivery: "sent" means a provider
 * accepted it, never that it arrived.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InlineNotice, LoadingSpinner, Switch } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import {
  describeDelivery, loadAllNotifyPrefs, loadMySnowProperties, loadNotifyPrefs, loadOwnerStopAlerts,
  loadSnowNotifications, setNotifyPrefs, setOwnerStopAlerts,
} from '@/data/snowNotifications';
import type { SnowNotification, SnowNotifyPrefs } from '@/types/snowNotifications';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

// What a property gets before anyone changes anything (matches update 031).
const DEFAULT_PREFS = { notifyOnArrival: false, notifyOnCompletion: true };

type Prefs = { notifyOnArrival: boolean; notifyOnCompletion: boolean };
const prefsOf = (p?: SnowNotifyPrefs | null): Prefs => ({
  notifyOnArrival: p?.notifyOnArrival ?? DEFAULT_PREFS.notifyOnArrival,
  notifyOnCompletion: p?.notifyOnCompletion ?? DEFAULT_PREFS.notifyOnCompletion,
});

// ── Customer ────────────────────────────────────────────────────────────────

export function CustomerNotifyPrefs() {
  const { colors } = useTheme();
  const [props, setProps] = useState<{ id: string; name: string; address: string }[]>([]);
  const [prefs, setPrefs] = useState<Record<string, Prefs>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, all] = await Promise.all([loadMySnowProperties(), loadAllNotifyPrefs()]);
    setLoading(false);
    if (!p.ok) return setError(p.error);
    if (!all.ok) return setError(all.error);
    setError(null);
    setProps(p.data);
    setPrefs(Object.fromEntries(p.data.map((x) => [x.id, prefsOf(all.data[x.id])])));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function change(propertyId: string, patch: Partial<Prefs>) {
    const before = prefs[propertyId] ?? prefsOf();
    setPrefs({ ...prefs, [propertyId]: { ...before, ...patch } });
    setSaving(propertyId);
    const res = await setNotifyPrefs(propertyId, patch);
    setSaving(null);
    if (!res.ok) {
      setPrefs((cur) => ({ ...cur, [propertyId]: before }));
      setError(res.error);
      return;
    }
    setError(null);
    setPrefs((cur) => ({ ...cur, [propertyId]: prefsOf(res.data) }));
  }

  if (loading) return <LoadingSpinner />;
  if (!props.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>Snow notifications</Text>
      {error ? <InlineNotice icon="alert-circle" tone="error" text={error} /> : null}
      {props.map((p) => {
        const v = prefs[p.id] ?? prefsOf();
        return (
          <View key={p.id} style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>{p.name}</Text>
            {p.address ? <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{p.address}</Text> : null}
            <ToggleRow
              title="Crew arrives"
              subtitle="A message when the crew gets to your property"
              value={v.notifyOnArrival}
              disabled={saving === p.id}
              onChange={(on) => change(p.id, { notifyOnArrival: on })}
            />
            <ToggleRow
              title="Service finished"
              subtitle="A message when the work is done"
              value={v.notifyOnCompletion}
              disabled={saving === p.id}
              onChange={(on) => change(p.id, { notifyOnCompletion: on })}
            />
          </View>
        );
      })}
    </View>
  );
}

// ── Owner: one property ─────────────────────────────────────────────────────

export function OwnerPropertyNotifications({ propertyId }: { propertyId: string }) {
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [recent, setRecent] = useState<SnowNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, n] = await Promise.all([loadNotifyPrefs(propertyId), loadSnowNotifications({ propertyId, limit: 8 })]);
      if (!alive) return;
      if (!p.ok) return setError(p.error);
      setError(null);
      setPrefs(prefsOf(p.data));
      setRecent(n.ok ? n.data.filter((x) => x.category === 'customer') : []);
    })();
    return () => { alive = false; };
  }, [propertyId]);

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typeScale.overline, styles.label, { color: colors.textSecondary }]}>CUSTOMER NOTIFICATIONS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {error ? <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{error}</Text> : !prefs ? <LoadingSpinner /> : (
          <>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>The customer chooses these. They stay the same for every storm.</Text>
            <StatusLine title="Crew arrives" on={prefs.notifyOnArrival} />
            <StatusLine title="Service finished" on={prefs.notifyOnCompletion} />
            <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>Recent messages</Text>
            {recent.length ? recent.map((n) => (
              <View key={n.id} style={{ gap: 2 }}>
                <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                  {n.title}{n.recipientName ? ` → ${n.recipientName}` : ''}
                </Text>
                {n.deliveries.map((d) => {
                  const info = describeDelivery(d);
                  return (
                    <Text key={d.id} style={[typeScale.caption, { color: info.tone === 'problem' ? colors.error : colors.textSecondary }]}>
                      {info.label}
                    </Text>
                  );
                })}
              </View>
            )) : <Text style={[typeScale.caption, { color: colors.textTertiary }]}>None yet.</Text>}
          </>
        )}
      </View>
    </View>
  );
}

function StatusLine({ title, on }: { title: string; on: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statusLine}>
      <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>{title}</Text>
      <Text style={[typeScale.bodyLarge, { color: on ? colors.primary : colors.textTertiary, fontWeight: '600' }]}>{on ? 'On' : 'Off'}</Text>
    </View>
  );
}

// ── Owner: own alerts ───────────────────────────────────────────────────────

export function OwnerStopAlertsToggle({ companyId }: { companyId: string }) {
  const { colors } = useTheme();
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    loadOwnerStopAlerts(companyId).then((res) => {
      if (!alive) return;
      if (res.ok) { setOn(res.data); setError(null); } else setError(res.error);
    });
    return () => { alive = false; };
  }, [companyId]);

  async function change(next: boolean) {
    const before = on;
    setOn(next);
    setSaving(true);
    const res = await setOwnerStopAlerts(companyId, next);
    setSaving(false);
    if (!res.ok) { setOn(before); setError(res.error); } else setError(null);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {error ? <InlineNotice icon="alert-circle" tone="error" text={error} /> : null}
      <ToggleRow
        title="Alert me when a stop is finished"
        subtitle="Just for you. Stops are still recorded on the dashboard and activity log when this is off."
        value={!!on}
        disabled={on === null || saving}
        onChange={change}
      />
    </View>
  );
}

// ── Shared ──────────────────────────────────────────────────────────────────

function ToggleRow({ title, subtitle, value, disabled, onChange }: {
  title: string; subtitle: string; value: boolean; disabled?: boolean; onChange: (on: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginLeft: spacing.sm, marginTop: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  statusLine: { flexDirection: 'row', alignItems: 'center' },
});
