import clsx from 'clsx';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

export type GlassSkeletonVariant = 'block' | 'circle' | 'text';

export type GlassSkeletonProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** How many lines a `text` skeleton draws. The last is shorter. Defaults to 3. */
  lines?: number;
  /** A `block` is sized with CSS, a `circle` is square and a `text` is a stack of lines. */
  variant?: GlassSkeletonVariant;
};

/**
 * A quiet glass placeholder with a slow sheen. It is hidden from assistive technology, so mark
 * the region that is loading with `aria-busy`.
 */
export const GlassSkeleton = forwardRef<HTMLDivElement, GlassSkeletonProps>(
  ({ className, lines = 3, variant = 'block', ...props }, forwardedRef) => {
    if (variant === 'text') {
      return (
        <div
          aria-hidden
          {...props}
          ref={forwardedRef}
          className={clsx('lg-skeleton-text', className)}
        >
          {Array.from({ length: Math.max(1, lines) }, (_, index) => (
            <span className="lg-skeleton" data-variant="line" key={index} />
          ))}
        </div>
      );
    }

    return (
      <div
        aria-hidden
        {...props}
        ref={forwardedRef}
        className={clsx('lg-skeleton', className)}
        data-variant={variant}
      />
    );
  },
);

GlassSkeleton.displayName = 'GlassSkeleton';
