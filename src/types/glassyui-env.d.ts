/**
 * Ambient DOM APIs referenced by GlassyUI registry code but missing from the
 * bundled TS lib.dom (scroll-driven animations are still Chromium-only).
 */
interface ViewTimelineOptions {
  axis?: 'block' | 'inline';
  subject?: Element;
}

declare class ViewTimeline extends AnimationTimeline {
  constructor(options?: ViewTimelineOptions);
  readonly source: Element | null;
  readonly startOffset: CSSNumericValue;
  readonly endOffset: CSSNumericValue;
}
