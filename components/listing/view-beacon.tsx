'use client';

import { useEffect } from 'react';

/** Today's date in Lagos, e.g. "2026-11-20". */
const lagosToday = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Counts this visit for the admin dashboard: once per listing per browser per
 * day, and only once the page is actually shown (not while the browser
 * prerenders it in the background). Renders nothing.
 */
export function ViewBeacon({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    const key = `viewed:${propertyId}`;
    const today = lagosToday();
    try {
      if (localStorage.getItem(key) === today) return;
    } catch {
      // Storage blocked: count the view anyway.
    }

    const send = () => {
      try {
        localStorage.setItem(key, today);
      } catch {}
      const body = JSON.stringify({ id: propertyId });
      if (!navigator.sendBeacon?.('/api/views', new Blob([body], { type: 'text/plain' }))) {
        fetch('/api/views', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    };

    if (document.visibilityState === 'visible') {
      send();
      return;
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onVisible);
      send();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [propertyId]);

  return null;
}
