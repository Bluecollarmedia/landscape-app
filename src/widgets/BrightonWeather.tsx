import { Gauge, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, containerBackground, font, foregroundStyle, frame, gaugeStyle, kerning, lineLimit, minimumScaleFactor, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { WidgetProps } from '@/lib/widgetData';

/**
 * Brighton Forecast on the home screen and the lock screen: small, medium (the next hours, or the storm outlook while one is posted), and the
 * three lock screen sizes. The look follows the approved mockup (light, minimal, the leaf and "BRIGHTON" on every size).
 *
 * A widget runs in its own small runtime, so everything it needs is inside this function (no outside constants, no hooks). The words and
 * figures arrive as props from src/lib/widgetData.ts, already formatted; the widget only lays them out.
 */
const BrightonWeather = (p: WidgetProps, env: WidgetEnvironment) => {
  'widget';
  const family = env.widgetFamily;
  const dark = env.colorScheme === 'dark';
  const ink = dark ? '#EAF3E6' : '#17301F';
  const soft = dark ? '#A9C0AC' : '#4C6B53';
  const page = dark ? '#18241C' : '#FBFDF8';
  const green = dark ? '#8CCB63' : '#2E5E34';
  const rule = dark ? '#2B3B30' : '#DCE6D5';
  const stormTint = dark ? '#1C3246' : '#E6F0FA';
  const stormInk = dark ? '#8FC2EE' : '#1D5F9A';
  const open = widgetURL('brighton-lawn://weather');

  const brand = (label: string, size: number) => (
    <HStack spacing={5}>
      {p.leaf ? <Image uiImage={p.leaf} modifiers={[frame({ width: size, height: size })]} /> : null}
      <Text modifiers={[font({ size: 9.5, weight: 'heavy' }), kerning(1.4), foregroundStyle(green), lineLimit(1)]}>{label}</Text>
    </HStack>
  );

  // ── lock screen: one line above the clock ──
  if (family === 'accessoryInline') {
    return <Text modifiers={[open]}>{`${p.place} ${p.temp} ${p.condition}`}</Text>;
  }

  // ── lock screen: the small circle ──
  if (family === 'accessoryCircular') {
    if (p.gauge) {
      return (
        <Gauge
          value={p.gauge.now}
          min={p.gauge.low}
          max={p.gauge.high}
          currentValueLabel={<Text modifiers={[font({ size: 17, weight: 'medium' })]}>{p.temp}</Text>}
          modifiers={[gaugeStyle('circularCapacity'), open]}
        >
          <Text>{p.place}</Text>
        </Gauge>
      );
    }
    return (
      <VStack spacing={0} modifiers={[open]}>
        {p.leaf ? <Image uiImage={p.leaf} modifiers={[frame({ width: 13, height: 13 })]} /> : null}
        <Text modifiers={[font({ size: 20, weight: 'medium' })]}>{p.temp}</Text>
      </VStack>
    );
  }

  // ── lock screen: the strip ──
  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[open]}>
        <HStack spacing={4}>
          {p.leaf ? <Image uiImage={p.leaf} modifiers={[frame({ width: 13, height: 13 })]} /> : null}
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), lineLimit(1)]}>{p.place}</Text>
        </HStack>
        <HStack spacing={6}>
          <Text modifiers={[font({ size: 26, weight: 'light' })]}>{p.temp}</Text>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), lineLimit(1)]}>{p.condition}</Text>
        </HStack>
        {p.highLow ? <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{p.highLow}</Text> : null}
      </VStack>
    );
  }

  // ── home screen: small ──
  if (family === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={0} modifiers={[containerBackground(page, 'widget'), open]}>
        {brand('BRIGHTON', 15)}
        <Spacer />
        <HStack alignment="top">
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(ink), lineLimit(1)]}>{p.place}</Text>
            <Text modifiers={[font({ size: 42, weight: 'light' }), foregroundStyle(ink), minimumScaleFactor(0.7)]}>{p.temp}</Text>
          </VStack>
          <Spacer />
          <Image systemName={p.symbol as any} size={30} color={p.symbolColor} />
        </HStack>
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1)]}>{p.condition}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(soft), lineLimit(1)]}>{[p.highLow, p.uv].filter(Boolean).join('  ·  ')}</Text>
      </VStack>
    );
  }

  // ── home screen: medium (also used for the large sizes, which are not offered) ──
  return (
    <VStack alignment="leading" spacing={0} modifiers={[containerBackground(page, 'widget'), open]}>
      <HStack alignment="top">
        <VStack alignment="leading" spacing={0}>
          <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(ink), lineLimit(1)]}>{p.place}</Text>
          <Text modifiers={[font({ size: 42, weight: 'light' }), foregroundStyle(ink), minimumScaleFactor(0.7)]}>{p.temp}</Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(soft), lineLimit(1)]}>{[p.condition, p.highLow].filter(Boolean).join('  ·  ')}</Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={3}>
          {brand('BRIGHTON FORECAST', 15)}
          {p.storm ? (
            <Image systemName={p.symbol as any} size={30} color={p.symbolColor} />
          ) : (
            <VStack alignment="trailing" spacing={2}>
              {p.uv ? <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(soft)]}>{p.uv}</Text> : null}
              {p.rain ? <Text modifiers={[font({ size: 12 }), foregroundStyle(soft), lineLimit(1)]}>{p.rain}</Text> : null}
            </VStack>
          )}
        </VStack>
      </HStack>
      <Spacer />
      {p.storm ? (
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[padding({ horizontal: 12, vertical: 8 }), frame({ maxWidth: 10000, alignment: 'leading' }), background(stormTint, shapes.roundedRectangle({ cornerRadius: 14 }))]}
        >
          <HStack spacing={5}>
            {p.leaf ? <Image uiImage={p.leaf} modifiers={[frame({ width: 14, height: 14 })]} /> : null}
            <Text modifiers={[font({ size: 11, weight: 'bold' }), kerning(0.8), foregroundStyle(stormInk), lineLimit(1)]}>{"BRIGHTON'S STORM OUTLOOK"}</Text>
          </HStack>
          <HStack>
            <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(ink), lineLimit(1)]}>{p.storm.headline}</Text>
            <Spacer />
            {p.storm.range ? <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(stormInk), lineLimit(1)]}>{p.storm.range}</Text> : null}
          </HStack>
        </VStack>
      ) : p.hours.length ? (
        <VStack spacing={8}>
          <HStack modifiers={[frame({ maxWidth: 10000, height: 1 }), background(rule)]}>
            <Spacer />
          </HStack>
          <HStack>
            {p.hours.map((h, i) => (
              <VStack key={`${i}`} spacing={3} modifiers={[frame({ maxWidth: 10000 })]}>
                <Text modifiers={[font({ size: 11 }), foregroundStyle(soft), lineLimit(1)]}>{h.label}</Text>
                <Image systemName={h.symbol as any} size={14} color={soft} />
                <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(ink)]}>{h.temp}</Text>
              </VStack>
            ))}
          </HStack>
        </VStack>
      ) : null}
    </VStack>
  );
};

export default createWidget('BrightonWeather', BrightonWeather);
