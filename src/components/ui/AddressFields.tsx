import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Input } from './Input';
import { spacing } from '@/theme/spacing';
import { splitAddress, type AddressParts } from '@/lib/address';

interface AddressFieldsProps {
  value: AddressParts;
  onChange: (next: AddressParts) => void;
  /** Adds " *" to the labels. */
  required?: boolean;
  streetLabel?: string;
  style?: ViewStyle;
}

/**
 * Street / City / State / ZIP. When autofill or a paste drops a whole address
 * into the street field, it's split across all four.
 */
export function AddressFields({ value, onChange, required, streetLabel = 'Street Address', style }: AddressFieldsProps) {
  const star = required ? ' *' : '';

  function handleStreet(text: string) {
    const parts = splitAddress(text);
    if (parts) {
      onChange({
        address: parts.address,
        city: parts.city || value.city,
        state: parts.state || value.state,
        zip: parts.zip || value.zip,
      });
    } else {
      onChange({ ...value, address: text });
    }
  }

  return (
    <View style={[styles.wrap, style]}>
      <Input
        label={`${streetLabel}${star}`}
        placeholder="123 Main St"
        value={value.address}
        onChangeText={handleStreet}
        icon="map-pin"
        textContentType="streetAddressLine1"
        autoComplete="street-address"
      />
      <View style={styles.row}>
        <Input
          label={`City${star}`}
          placeholder="City"
          value={value.city}
          onChangeText={(city) => onChange({ ...value, city })}
          textContentType="addressCity"
          containerStyle={styles.flex2}
        />
        <Input
          label={`State${star}`}
          placeholder="NJ"
          value={value.state}
          onChangeText={(state) => onChange({ ...value, state: state.toUpperCase() })}
          textContentType="addressState"
          autoCapitalize="characters"
          maxLength={2}
          containerStyle={styles.flex1}
        />
        <Input
          label={`ZIP${star}`}
          placeholder="08701"
          value={value.zip}
          onChangeText={(zip) => onChange({ ...value, zip })}
          textContentType="postalCode"
          autoComplete="postal-code"
          keyboardType="number-pad"
          maxLength={10}
          containerStyle={styles.flex1}
        />
      </View>
    </View>
  );
}

/** Message for the first missing part, or null when all four are filled in. */
export function missingAddressPart(a: AddressParts): string | null {
  if (!a.address.trim()) return 'Please enter the street address.';
  if (!a.city.trim()) return 'Please enter the city.';
  if (!/^[A-Za-z]{2}$/.test(a.state.trim())) return 'Please enter the 2-letter state.';
  if (!/^\d{5}(-\d{4})?$/.test(a.zip.trim())) return 'Please enter a 5-digit ZIP code.';
  return null;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
});
