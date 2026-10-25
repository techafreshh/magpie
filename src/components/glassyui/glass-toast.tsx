'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import clsx from 'clsx';
import { forwardRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { GlassPanel } from './glass-panel';

const subscribeToClient = () => () => {};

const getClientSnapshot = () => true;

const getServerSnapshot = () => false;

export const GlassToastProvider = ToastPrimitive.Provider;

export const GlassToastViewport = (
  props: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>,
) => {
  const canPortal = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot);

  if (!canPortal) return null;

  return createPortal(
    <ToastPrimitive.Viewport {...props} className={clsx('lg-toast-viewport', props.className)} />,
    document.body,
  );
};

export function GlassToast(props: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>) {
  const { className, children, ...rest } = props;

  return (
    <ToastPrimitive.Root {...rest} className={clsx('lg-toast', className)}>
      <GlassPanel refraction="soft" variant="card" elevation="raised" className="lg-toast-root">
        {children}
      </GlassPanel>
    </ToastPrimitive.Root>
  );
}

export const GlassToastTitle = (
  props: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>,
) => <ToastPrimitive.Title {...props} className={clsx('lg-toast-title', props.className)} />;

export const GlassToastDescription = (
  props: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>,
) => (
  <ToastPrimitive.Description
    {...props}
    className={clsx('lg-toast-description', props.className)}
  />
);

/**
 * A round button that dismisses the toast. It draws its own × and is named "Dismiss"; give it
 * children and their text names it, or pass `aria-label`.
 */
export const GlassToastClose = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ children, className, ...props }, forwardedRef) => (
  <ToastPrimitive.Close
    aria-label={children === undefined ? 'Dismiss' : undefined}
    {...props}
    ref={forwardedRef}
    className={clsx('lg-toast-close', className)}
  >
    {children ?? (
      <svg aria-hidden viewBox="0 0 20 20">
        <path
          d="M5.5 5.5l9 9m0-9l-9 9"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    )}
  </ToastPrimitive.Close>
));

GlassToastClose.displayName = 'GlassToastClose';

/** A pill under the message, such as Undo. `altText` says how to do it without the button. */
export const GlassToastAction = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, forwardedRef) => (
  <ToastPrimitive.Action
    {...props}
    ref={forwardedRef}
    className={clsx('lg-toast-action', className)}
  />
));

GlassToastAction.displayName = 'GlassToastAction';
