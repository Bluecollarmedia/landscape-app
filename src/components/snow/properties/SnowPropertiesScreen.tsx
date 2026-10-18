/**
 * Snow Mode Properties tab (Owner): every snow property with the services
 * it offers, and an Add Property form. Contacts, services, instructions and
 * reference media are edited on the property screen (update 022). Working
 * layout in the existing app style; no approved mockup yet.
 */
import { applyStreetInput } from '@/lib/address';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, InlineNotice, Input, LoadingSpinner, SearchBar } from '@/components/ui';
import { showMessage } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { db } from '@/data/store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SERVICE_LABEL } from '@/data/snowStorms';
import type { SnowService } from '@/types/snow';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface Row { id: string; name: string; address: string; status: 'active' | 'inactive'; services: SnowService[] }

const EMPTY = { name: '', address: '', city: '', state: '', zip: '' };

export function SnowPropertiesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return setError('Snow properties need the live database.'); }
    const { data, error: e } = await supabase
      .from('snow_properties')
      .select('id, name, address, city, state, status, snow_property_services(service, is_active)')
      .order('name');
    setLoading(false);
    if (e) return setError('Couldn\'t load snow properties.');
    setError(null);
    setRows((data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      address: [p.address, p.city, p.state].filter(Boolean).join(', '),
      status: p.status,
      services: ((p.snow_property_services ?? []) as { service: SnowService; is_active: boolean }[])
        .filter((s) => s.is_active).map((s) => s.service),
    })));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const open = (id: string) => router.push({ pathname: '/snow/owner/property', params: { id } });

  async function save() {
    let companyId = db.companyId;
    if (!companyId) {
      const { data: m } = await supabase.from('company_members').select('company_id')
        .in('role', ['owner', 'admin']).eq('status', 'active').limit(1).maybeSingle();
      companyId = m?.company_id ?? undefined;
    }
    if (!form.name.trim() || !form.address.trim()) return showMessage('Add a name and address', 'Both are needed so the crew can find the property.');
    if (!companyId) return showMessage('Couldn\'t add the property', 'Your company wasn\'t found. Sign out and back in.');
    setSaving(true);
    const { data, error: e } = await supabase.from('snow_properties').insert({
      company_id: companyId,
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
    }).select('id').single();
    setSaving(false);
    if (e || !data) return showMessage('Couldn\'t add the property', e?.message ?? 'Try again.');
    setForm(EMPTY);
    setAdding(false);
    reload();
    open(data.id);
  }

  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => `${r.name} ${r.address}`.toLowerCase().includes(q)) : rows;
  const set = (k: keyof typeof EMPTY) => (v: string) => setForm({ ...form, [k]: v });

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: tabBarClearance + spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary, flex: 1 }]}>Properties</Text>
          {!adding ? <Button title="Add" icon="plus" size="sm" onPress={() => setAdding(true)} /> : null}
        </View>
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} style={{ marginTop: spacing.md }} /> : null}

        {adding ? (
          <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.md, gap: spacing.sm }]}>
            <Input label="Property name" value={form.name} onChangeText={set('name')} placeholder="Oak Plaza" />
            <Input
              label="Street address"
              value={form.address}
              onChangeText={(text) => setForm((f) => ({ ...f, ...applyStreetInput(text, f) }))}
              placeholder="1 Oak St"
              textContentType="fullStreetAddress"
              autoComplete="street-address"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Input label="City" value={form.city} onChangeText={set('city')} containerStyle={{ flex: 2 }} />
              <Input label="State" value={form.state} onChangeText={set('state')} containerStyle={{ flex: 1 }} autoCapitalize="characters" />
              <Input label="ZIP" value={form.zip} onChangeText={set('zip')} containerStyle={{ flex: 1 }} keyboardType="number-pad" />
            </View>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
              After saving, turn on plowing, shoveling or salting and add contacts and instructions.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button title="Cancel" variant="ghost" onPress={() => { setAdding(false); setForm(EMPTY); }} />
              <Button title="Save property" loading={saving} onPress={save} />
            </View>
          </View>
        ) : null}

        {rows.length > 6 ? <SearchBar value={query} onChangeText={setQuery} placeholder="Search properties" style={{ marginTop: spacing.md }} /> : null}

        {loading ? <LoadingSpinner /> : !rows.length && !adding ? (
          <EmptyState icon="home" title="No snow properties yet" description="Add the lots, driveways and walks your crews clear." />
        ) : (
          <View style={[styles.group, { backgroundColor: colors.surface, marginTop: spacing.md }]}>
            {shown.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => open(r.id)}
                accessibilityRole="button"
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
              >
                <View style={{ flex: 1, gap: 2, opacity: r.status === 'inactive' ? 0.5 : 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                    {r.name}{r.status === 'inactive' ? ' (inactive)' : ''}
                  </Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>{r.address}</Text>
                  <Text style={[typeScale.caption, { color: r.services.length ? colors.primary : colors.warning }]}>
                    {r.services.length ? r.services.map((s) => SERVICE_LABEL[s]).join(' · ') : 'No services on yet'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 60 },
});
