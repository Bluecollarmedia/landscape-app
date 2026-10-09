export interface AddressParts {
  address: string;
  city: string;
  state: string;
  zip: string;
}

const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

function stateCode(s: string): string | null {
  const t = s.trim().replace(/\./g, '');
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATES[t.toLowerCase()] ?? null;
}

/**
 * Splits a whole US address pasted or autofilled into the street field
 * ("205 Cathy Ln, Lakewood NJ 08701", "205 Cathy Ln\nLakewood, NJ 08701, United States")
 * into its parts. Returns null when the text is just a street.
 */
export function splitAddress(text: string): AddressParts | null {
  const parts = text
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^(usa|us|united states( of america)?)$/i.test(p));
  if (parts.length < 2) return null;

  // Last part should end with "STATE ZIP", "STATE", or "ZIP" (state may then be its own part).
  let last = parts.pop()!;
  let zip = '';
  const zipMatch = last.match(/\s*(\d{5})(?:-\d{4})?$/);
  if (zipMatch) {
    zip = zipMatch[1];
    last = last.slice(0, zipMatch.index).trim();
  }

  let state = '';
  let city = '';
  if (last) {
    // "Lakewood NJ" or "NJ" or "New Jersey"
    const whole = stateCode(last);
    if (whole) {
      state = whole;
    } else {
      const m = last.match(/^(.*?)[\s]+([A-Za-z]{2})$/);
      if (m && stateCode(m[2])) {
        city = m[1].trim();
        state = stateCode(m[2])!;
      } else {
        city = last;
      }
    }
  }
  if (!city && parts.length >= 2) city = parts.pop()!;
  if (!state && !zip) return null;
  const address = parts.join(', ');
  if (!address) return null;
  return { address, city, state, zip };
}

export function formatAddress(a: Partial<AddressParts>): string {
  return [a.address, a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter((s) => s && s.trim()).join(', ');
}
