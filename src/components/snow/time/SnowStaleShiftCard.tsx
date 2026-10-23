/** The Snow clock's version of the one "you didn't clock out" card (see components/time/StaleSessionCard). */
import React, { useState } from 'react';
import { StaleSessionCard } from '@/components/time/StaleSessionCard';
import type { SnowShift } from '@/data/snowShifts';

export function SnowStaleShiftCard({ shift, busy, onAnswer }: {
  shift: SnowShift;
  busy: boolean;
  /** Resolves with an error sentence, or null when it was saved. */
  onAnswer: (stoppedAtIso: string | null) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <StaleSessionCard
      session={{ id: shift.id, clockInAt: shift.originalIn, claimedOutAt: shift.claimedOutAt, claimNote: shift.claimNote, answered: !!shift.claimedAt }}
      busy={busy}
      nowMs={Date.now()}
      error={error}
      onAnswer={async (iso) => { setError(await onAnswer(iso)); }}
    />
  );
}
