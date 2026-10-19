import React from 'react';
import { SnowPropertiesScreen } from '@/components/snow/properties/SnowPropertiesScreen';

/** Properties as its own screen (opened from Snow settings), instead of switching to the Properties tab. */
export default function SnowOwnerPropertiesList() {
  return <SnowPropertiesScreen asTab={false} />;
}
