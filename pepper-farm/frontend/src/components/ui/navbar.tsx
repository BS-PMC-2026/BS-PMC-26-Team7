'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, MotionConfig } from 'framer-motion';
import * as React from 'react';

export type IMenu = {
  id: number;
  title: string;
  url: string;
  dropdown?: boolean;
  items?: IMenu[];
};

type MenuProps = {
  list: IMenu[];
};

const Menu = ({ list }: MenuProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const router = useRouter();

  return (
    <MotionConfig transition={{ bounce: 0, type: 'tween' }}>
      <nav className={'relative'}>
        <ul className={'flex items-center'}>
          {list?.map((item) => {
            return (
              <li key={item.id} className={'relative'}>
                <Link
                  className={`
                    relative flex items-center justify-center rounded px-8 py-3 transition-all
                    hover:bg-foreground/10
                    ${hovered === item?.id ? 'bg-foreground/10' : ''}
                  `}
                  onMouseEnter={() => setHovered(item.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={(e) => {
                    // A dropdown trigger has no real destination (url is '#'); it must
                    // only open/close the menu. Without this, the first click lands on
                    // the trigger and navigates to '#' (back to the home page).
                    if (item?.dropdown) {
                      e.preventDefault();
                      setHovered((cur) => (cur === item.id ? null : item.id));
                    }
                  }}
                  href={item?.url}
                >
                  {item?.title}
                </Link>
                {hovered === item?.id && !item?.dropdown && (
                  <motion.div
                    layout
                    layoutId={`cursor`}
                    className={'absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-foreground'}
                  />
                )}
                {item?.dropdown && hovered === item?.id && (
                  <div
                    /* pt-4 (padding, not margin) keeps the gap between the trigger
                       and the panel inside the hover hit-box, so moving the pointer
                       down to an item doesn't drop `hovered` and unmount the menu
                       before the click registers. Fixes first-click-doesn't-navigate. */
                    className='absolute left-0 top-full pt-4'
                    onMouseEnter={() => setHovered(item.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {/* Opacity-only entrance — no `layout`, no shared `layoutId`,
                        no translate. A transform animation (especially the
                        `layoutId='cursor'` shared with the underline dot) renders
                        the panel offset from its real hit-box, so the first click
                        passes through to the page behind. Fading in place keeps the
                        menu anchors exactly under the pointer for first-click nav. */}
                    <motion.div
                      transition={{ duration: 0.15 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        borderRadius: '8px',
                      }}
                      className='flex w-64 flex-col rounded bg-background border'
                    >
                      {item?.items?.map((nav) => {
                        return (
                          <motion.a
                            key={`link-${nav?.id}`}
                            href={`${nav?.url}`}
                            onMouseDown={(e) => {
                              // Navigate on press (mousedown fires before the hover
                              // mouseleave that unmounts the menu and before the click
                              // event), so the FIRST click always reaches the target.
                              if (e.button !== 0) return; // ignore middle/right click
                              e.preventDefault();
                              setHovered(null);
                              router.push(nav.url);
                            }}
                            onClick={(e) => {
                              e.preventDefault(); // mouse already handled on mousedown
                              if (e.detail === 0) {
                                // Keyboard activation (Enter) — no preceding mousedown.
                                setHovered(null);
                                router.push(nav.url);
                              }
                            }}
                            className={'w-full p-4 hover:bg-muted text-foreground'}
                          >
                            {nav?.title}
                          </motion.a>
                        );
                      })}
                    </motion.div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </MotionConfig>
  );
};

export default Menu;
