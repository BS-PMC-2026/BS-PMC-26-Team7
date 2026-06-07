"use client";

import { useEffect, useMemo, useState } from "react";

interface PepperSpinnerLoaderProps {
  isLoading?: boolean;
  minDelay?: number;
  text?: string;
  fullscreen?: boolean;
}

const PEPPER_COUNT = 8;

const PEPPER_SWATCHES = [
  { body: "#2F6F2F", shadow: "#1F4D24", stem: "#42682E", highlight: "#D7E9C8", opacity: 1, scale: 1.02 },
  { body: "#D83A2E", shadow: "#A92420", stem: "#7B4822", highlight: "#FFE0D8", opacity: 1, scale: 1.04 },
  { body: "#7FA46D", shadow: "#5E804D", stem: "#6C8C4E", highlight: "#E4EFD8", opacity: 0.78, scale: 0.98 },
  { body: "#A6BD8D", shadow: "#7F9869", stem: "#8AA06B", highlight: "#EFF6E7", opacity: 0.48, scale: 0.96 },
  { body: "#C7D5B3", shadow: "#9BAD86", stem: "#9DAE78", highlight: "#F7FAEF", opacity: 0.35, scale: 0.94 },
  { body: "#9AB87D", shadow: "#71935D", stem: "#789756", highlight: "#EDF5E5", opacity: 0.64, scale: 0.98 },
  { body: "#6F9A55", shadow: "#4D7439", stem: "#587A3E", highlight: "#E3EFD7", opacity: 0.84, scale: 1 },
  { body: "#315F29", shadow: "#21451E", stem: "#42682E", highlight: "#D3E5C4", opacity: 1, scale: 1.02 },
];

export default function PepperSpinnerLoader({
  isLoading = true,
  minDelay = 250,
  text = "Loading",
  fullscreen = false,
}: PepperSpinnerLoaderProps) {
  const [visible, setVisible] = useState(minDelay <= 0);
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (!isLoading) {
      setVisible(false);
      return;
    }

    if (minDelay <= 0) {
      setVisible(true);
      return;
    }

    setVisible(false);
    const timer = window.setTimeout(() => setVisible(true), minDelay);
    return () => window.clearTimeout(timer);
  }, [isLoading, minDelay]);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setInterval(() => {
      setDotCount((current) => (current % 3) + 1);
    }, 450);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const peppers = useMemo(
    () =>
      Array.from({ length: PEPPER_COUNT }).map((_, index) => ({
        angle: (360 / PEPPER_COUNT) * index,
        ...PEPPER_SWATCHES[index],
      })),
    [],
  );

  if (!isLoading || !visible) return null;

  const content = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col items-center justify-center gap-4"
      data-testid="pepper-spinner-loader"
    >
      <div className="relative h-32 w-32 animate-[pepper-loader-spin_1.35s_linear_infinite] motion-reduce:animate-none">
        {peppers.map((pepper, index) => (
          <span
            key={index}
            className="absolute left-1/2 top-1/2 block origin-center"
            style={{
              opacity: pepper.opacity,
              transform: `translate(-50%, -50%) rotate(${pepper.angle}deg) translateY(-45px) scale(${pepper.scale})`,
              filter: "drop-shadow(0 5px 8px rgb(47 85 45 / 0.2))",
            }}
            aria-hidden="true"
          >
            <svg
              width="34"
              height="54"
              viewBox="0 0 34 54"
              className="block -rotate-[22deg]"
              fill="none"
            >
              <path
                d="M18.4 6.5c-2.5-3.1-5-4.7-7.3-4.8"
                stroke={pepper.stem}
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <path
                d="M18.7 6.2c7.1 4.7 10 13.2 7.8 22.7-2.4 10.3-9.9 18.1-20.2 20.7-1.9.5-3.4-1.4-2.5-3.1 3.4-6.5 3.1-14.4 4.1-22.4C9.1 14.2 12.8 7.8 18.7 6.2Z"
                fill={pepper.body}
              />
              <path
                d="M20.8 10.4c4.4 5.6 5.1 12.5 2.3 20.3-2.8 7.5-8.4 13.1-15.9 16"
                stroke={pepper.shadow}
                strokeWidth="4.2"
                strokeLinecap="round"
                opacity="0.42"
              />
              <path
                d="M20.2 13.7c2.7 3.1 3.3 7.2 1.7 12.1"
                stroke={pepper.highlight}
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M16.4 37.8c-2 2.6-4.6 4.4-7.8 5.4"
                stroke={pepper.highlight}
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.55"
              />
            </svg>
          </span>
        ))}
      </div>
      <p className="text-[1.35rem] font-normal text-[#315F29]">
        {text}
        {".".repeat(dotCount)}
      </p>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-[#F6F8F4]/65 px-6 backdrop-blur-[2px]">
        {content}
      </div>
    );
  }

  return (
    <div className="app-page-bg flex items-center justify-center px-6">
      {content}
    </div>
  );
}
