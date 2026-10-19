// What the customer's project Overview shows: a few meaningful updates and a one-line billing summary. Pure, no network.

interface TimelineLike { id: string; eventType: string; title: string; timestamp: string }

/** Event kinds that are real news for a customer (shared updates and photos). Never "started", "progress" or replies. */
const MEANINGFUL = new Set(['update_shared', 'photo_shared']);
/** Titles that say nothing, even when they arrive as an update. */
const GENERIC = /^(project (started|updated|created)|worker arrived|task created|started the day|arrived|progress updated)\b/i;

export function meaningfulUpdates<T extends TimelineLike>(events: T[], max = 3): T[] {
  return events
    .filter((e) => MEANINGFUL.has(e.eventType) && e.title.trim() && !GENERIC.test(e.title.trim()))
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, max);
}

/** The Billing card's small status: what needs the customer first, else how many invoices are out. Null when nothing to say. */
export function billingStatus(counts: { waiting: number; issuedInvoices: number }): { label: string } | null {
  if (counts.waiting > 0) return { label: counts.waiting === 1 ? '1 needs review' : `${counts.waiting} need review` };
  if (counts.issuedInvoices > 0) return { label: `${counts.issuedInvoices} issued` };
  return null;
}

export const documentCountLabel = (n: number) => `${n} ${n === 1 ? 'document' : 'documents'}`;
