import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, Input, Card } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function NewCustomerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  function handleCreate() {
    if (!firstName.trim() || !lastName.trim()) {
      if (Platform.OS === 'web') {
        alert('Please enter a first and last name.');
      } else {
        Alert.alert('Required', 'Please enter a first and last name.');
      }
      return;
    }
    router.back();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="x" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
            Add Customer
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Card title="Customer Info">
            <View style={styles.row}>
              <Input
                label="First Name"
                placeholder="Sarah"
                value={firstName}
                onChangeText={setFirstName}
                containerStyle={{ ...styles.fieldGap, flex: 1 }}
              />
              <Input
                label="Last Name"
                placeholder="Mitchell"
                value={lastName}
                onChangeText={setLastName}
                containerStyle={{ ...styles.fieldGap, flex: 1 }}
              />
            </View>
            <Input
              label="Email"
              placeholder="sarah@email.com"
              value={email}
              onChangeText={setEmail}
              icon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
              containerStyle={styles.fieldGap}
            />
            <Input
              label="Phone"
              placeholder="(216) 555-0000"
              value={phone}
              onChangeText={setPhone}
              icon="phone"
              keyboardType="phone-pad"
              containerStyle={styles.fieldGap}
            />
          </Card>

          <View style={styles.actions}>
            <Button title="Add Customer" onPress={handleCreate} icon="user-plus" fullWidth size="lg" />
            <Button title="Cancel" onPress={() => router.back()} variant="ghost" fullWidth />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backButton: { padding: spacing.xs },
  scrollContent: { paddingBottom: spacing['5xl'] },
  form: { padding: spacing.lg },
  fieldGap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  actions: { marginTop: spacing['2xl'], gap: spacing.sm },
});
