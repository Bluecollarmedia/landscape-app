/**
 * Hands the Brighton Forecast widgets their forecast (iPhone only).
 *
 * Called whenever a fresh forecast or storm outlook is on screen. It gives the phone a timeline (one entry per coming hour) so the widget keeps
 * showing the right temperature between app opens. Everything here is best effort and never throws: on a phone whose app build does not have the
 * widgets yet (an over-the-air update reaching an older build), on the web, or when anything goes wrong, it simply does nothing.
 */
import { Image, Platform } from 'react-native';
import { buildWidgetEntries } from '@/lib/widgetData';
import type { WeatherPayload } from '@/lib/weatherView';
import type { StormOutlook } from '@/lib/stormView';

let lastKey = '';
let leafPromise: Promise<string | null> | null = null;

/** The leaf logo as a file in the folder the widgets can read (copied once). */
function leafFile(dir: string | null): Promise<string | null> {
  if (!dir) return Promise.resolve(null);
  if (!leafPromise) {
    leafPromise = (async () => {
      try {
        const legacy = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
        const dest = `${dir}${dir.endsWith('/') ? '' : '/'}brighton-leaf.png`;
        const info = await legacy.getInfoAsync(dest);
        if (!info.exists) {
          const from = Image.resolveAssetSource(require('../../assets/images/logo-leaf.png')).uri;
          if (/^https?:/i.test(from)) await legacy.downloadAsync(from, dest);
          else await legacy.copyAsync({ from, to: dest });
        }
        return dest;
      } catch {
        return null;
      }
    })();
  }
  return leafPromise;
}

export async function syncWidgets(data: WeatherPayload | null, storm: StormOutlook | null): Promise<void> {
  if (Platform.OS !== 'ios' || !data) return;
  // Nothing new to say: same place, same forecast, same storm version.
  const key = `${data.town}|${data.fetchedAt}|${storm?.id ?? ''}|${storm?.latest?.version_no ?? ''}|${storm?.status ?? ''}`;
  if (key === lastKey) return;
  try {
    const widgets = require('expo-widgets') as typeof import('expo-widgets');
    const widget = (require('@/widgets/BrightonWeather') as typeof import('@/widgets/BrightonWeather')).default;
    const leaf = await leafFile(widgets.widgetsDirectory ?? null);
    const entries = buildWidgetEntries(data, storm, Date.now(), leaf);
    widget.updateTimeline(entries.map((e) => ({ date: e.date, props: e.props })));
    lastKey = key;
  } catch {
    /* the widgets are not in this build, or the phone said no: the app carries on */
  }
}
