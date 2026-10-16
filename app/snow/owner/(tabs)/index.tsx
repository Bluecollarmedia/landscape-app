import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SnowDashboard } from '@/components/snow/SnowDashboard';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';

/** Snow Mode owner home: Needs Attention and Storm Overview. */
export default function SnowOwnerHome() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  return <SnowDashboard topInset={insets.top} bottomInset={tabBarClearance} />;
}
