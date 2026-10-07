import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, Input, Card } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function NewProjectScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');

  function handleCreate() {
    if (!name.trim()) {
      if (Platform.OS === 'web') {
        alert('Please enter a project name.');
      } else {
        Alert.alert('Required', 'Please enter a project name.');
      }
      return;
    }
    router.back();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Cancel"
          >
            <Icon name="x" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
            New Project
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Card title="Project Info">
            <Input
              label="Project Name"
              placeholder="e.g. Smith Backyard Renovation"
              value={name}
              onChangeText={setName}
              icon="folder"
              containerStyle={styles.fieldGap}
            />
            <Input
              label="Street Address"
              placeholder="123 Main St"
              value={address}
              onChangeText={setAddress}
              icon="map-pin"
              containerStyle={styles.fieldGap}
            />
            <View style={styles.row}>
              <Input
                label="City"
                placeholder="Cleveland"
                value={city}
                onChangeText={setCity}
                containerStyle={{ ...styles.fieldGap, flex: 2 }}
              />
              <Input
                label="State"
                placeholder="OH"
                value={state}
                onChangeText={setState}
                containerStyle={{ ...styles.fieldGap, flex: 1 }}
                maxLength={2}
                autoCapitalize="characters"
              />
              <Input
                label="ZIP"
                placeholder="44122"
                value={zip}
                onChangeText={setZip}
                containerStyle={{ ...styles.fieldGap, flex: 1 }}
                maxLength={5}
                keyboardType="number-pad"
              />
            </View>
          </Card>

          <Card title="Internal Notes" style={{ marginTop: spacing.lg }}>
            <Input
              placeholder="Any notes about this project (not visible to customer)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              containerStyle={styles.fieldGap}
            />
          </Card>

          <View style={styles.actions}>
            <Button
              title="Create Project"
              onPress={handleCreate}
              icon="plus"
              fullWidth
              size="lg"
            />
            <Button
              title="Cancel"
              onPress={() => router.back()}
              variant="ghost"
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    paddingBottom: spacing['5xl'],
  },
  form: {
    padding: spacing.lg,
  },
  fieldGap: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actions: {
    marginTop: spacing['2xl'],
    gap: spacing.sm,
  },
});
