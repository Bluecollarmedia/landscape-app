/**
 * Who checks the crew in at a maintenance property (update 68): the route's crew leader. Owner and admin may too. A route with no leader
 * named keeps the older rule (any crew member), so nothing is blocked until an owner names a leader. The database enforces the same
 * rule; this only decides which buttons a person is shown.
 */
export function isCrewLeader(input: { leadId?: string | null; personId?: string | null; role?: string | null }): boolean {
  if (input.role === 'owner' || input.role === 'admin') return true;
  if (!input.personId) return false;
  if (input.leadId) return input.leadId === input.personId;
  return true;
}

/** What a crew member who is not the leader sees at a stop, in plain words. */
export function crewStopMessage(status: string, leaderName?: string | null, arrivedTime?: string | null, arrivedBy?: string | null): string {
  const who = leaderName || 'the crew leader';
  if (status === 'pending') return `Waiting for ${who} to check the crew in at this property.`;
  if (status === 'arrived') return `In progress${arrivedTime ? ` since ${arrivedTime}` : ''}${arrivedBy ? ` (checked in by ${arrivedBy})` : ''}. ${who[0].toUpperCase() + who.slice(1)} finishes the stop.`;
  return status === 'completed' ? 'Finished.' : 'Skipped.';
}
