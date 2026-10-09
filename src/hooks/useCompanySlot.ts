import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Whether "Create a Company" should be offered. The app allows one company at
 * a time: once it has an owner with a working login, nobody else can create one.
 * Starts hidden until the server answers; demo mode always shows it.
 */
export function useCompanySlotOpen(): boolean {
  const [open, setOpen] = useState(!isSupabaseConfigured);

  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) return;
      let active = true;
      supabase.rpc('company_slot_open').then(({ data, error }) => {
        if (!active) return;
        // Database not updated yet (no such function): keep the old behavior.
        setOpen(error ? true : data === true);
      });
      return () => { active = false; };
    }, []),
  );

  return open;
}
