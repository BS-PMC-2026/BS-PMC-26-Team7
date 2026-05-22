'use client';

/**
 * US30: /manager/spray-alerts — redirects to the Spray Alert History section
 * embedded in the Spray Map page (/manager/spray-map#spray-alerts).
 *
 * The alert inbox was consolidated into the Spray Map page so all spray safety
 * information lives in one place. The bell-panel "View all" link also points
 * there. This redirect keeps old bookmarks working.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SprayAlertsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/manager/spray-map#spray-alerts');
  }, [router]);
  return null;
}
