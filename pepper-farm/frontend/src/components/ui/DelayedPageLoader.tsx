"use client";

import PepperSpinnerLoader from "./PepperSpinnerLoader";

interface DelayedPageLoaderProps {
  delayMs?: number;
}

export default function DelayedPageLoader({ delayMs = 250 }: DelayedPageLoaderProps) {
  return <PepperSpinnerLoader minDelay={delayMs} />;
}
