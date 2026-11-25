"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Motion helpers for things that change while you look at them: a score that
 * comes in, a player who overtakes another, a number that goes up.
 *
 * CSS handles everything that only has to play once (see the `animate-*`
 * utilities in globals.css). What needs to know the *previous* state, such as
 * where a row was before the list was re-sorted, lives here and uses the Web
 * Animations API, which CSS's reduced-motion rule does not reach, so every
 * hook checks the visitor's preference itself.
 */

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the visitor asked for less motion. `false` on the server. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches;
}

// ------------------------------------------------------------ hydration --

let hydrated = false;
const hydrationListeners = new Set<() => void>();

/**
 * Called once by the app's providers after the first render has reached the
 * screen. Components that count up or pop in on mount only do so after this:
 * the first page load shows its numbers as the server rendered them, while a
 * page opened later in the app arrives with movement.
 */
export function markHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  for (const listener of hydrationListeners) listener();
}

export function isHydrated(): boolean {
  return hydrated;
}

// --------------------------------------------------------- change count --

/**
 * Counts how often `value` changed since the component mounted: 0 on the
 * first render, then 1, 2, … Use it as a React `key` to replay a CSS
 * animation each time the value changes, but not when it first appears.
 */
export function useChangeCount(value: string | number | boolean | null | undefined): number {
  const [state, setState] = useState({ value, count: 0 });
  if (!Object.is(state.value, value)) {
    // Storing information from the previous render, as React recommends:
    // React re-renders immediately with the new state.
    const next = { value, count: state.count + 1 };
    setState(next);
    return next.count;
  }
  return state.count;
}

/** The direction a number moved in on its last change: 1 up, -1 down, 0 not yet. */
export function useDirection(value: number | null): -1 | 0 | 1 {
  const [state, setState] = useState<{ value: number | null; direction: -1 | 0 | 1 }>({ value, direction: 0 });
  if (!Object.is(state.value, value)) {
    const direction = value === null || state.value === null ? 0 : value > state.value ? 1 : -1;
    setState({ value, direction });
    return direction;
  }
  return state.direction;
}

// ------------------------------------------------------------------ FLIP --

interface Tracked {
  element: HTMLElement;
  signature: string;
}

interface Known {
  top: number;
  left: number;
  signature: string;
}

export interface FlipOptions {
  /** How a row that was not there before arrives. Default: it slides down into place. */
  enter?: "slide" | "pop" | "none";
  /** Highlight a row whose signature changed. Default: true. */
  flash?: boolean;
  /** Called with the keys whose signature changed, after the frame they changed in. */
  onChange?: (keys: string[]) => void;
}

/**
 * Animates a list whose rows move, appear and change, e.g. a leaderboard
 * that re-sorts as scores come in ("FLIP": First, Last, Invert, Play).
 *
 * Register every row with a stable key and a signature of what it shows:
 *
 *   const flip = useFlip();
 *   <li ref={flip(row.id, `${row.strokes}|${row.thru}`)}>
 *
 * After each render, rows that moved glide from their old place to the new
 * one, new rows slide in, and rows whose signature changed light up. Nothing
 * animates on the first render.
 */
export function useFlip(options: FlipOptions = {}): (key: string, signature?: string) => (element: HTMLElement | null) => void {
  const tracked = useRef(new Map<string, Tracked>());
  const known = useRef(new Map<string, Known>());
  const mounted = useRef(false);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useLayoutEffect(() => {
    const { enter = "slide", flash = true, onChange } = optionsRef.current;
    const reduced = prefersReducedMotion();
    const first = !mounted.current;
    mounted.current = true;
    const changed: string[] = [];
    const next = new Map<string, Known>();

    for (const [key, { element, signature }] of tracked.current) {
      // Offsets are layout positions: unaffected by scrolling and by
      // transforms that are still running from the previous update.
      const top = element.offsetTop;
      const left = element.offsetLeft;
      next.set(key, { top, left, signature });
      if (first || reduced) continue;
      const before = known.current.get(key);
      if (!before) {
        if (enter === "slide") {
          element.animate(
            [
              { opacity: 0, transform: "translateY(-12px) scale(0.98)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
          );
        } else if (enter === "pop") {
          element.animate(
            [
              { opacity: 0, transform: "scale(0.85)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 460, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "backwards" },
          );
        }
        continue;
      }
      const dx = before.left - left;
      const dy = before.top - top;
      if (dx !== 0 || dy !== 0) {
        element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
          duration: 560,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          composite: "add",
        });
      }
      if (before.signature !== signature) {
        changed.push(key);
        if (flash) flashElement(element);
      }
    }
    known.current = next;
    if (changed.length > 0) onChange?.(changed);
  });

  return useCallback(
    (key: string, signature = "") => (element: HTMLElement | null) => {
      if (!element) return;
      tracked.current.set(key, { element, signature });
      // React 19 calls this when the row unmounts or re-renders with a new callback.
      return () => {
        if (tracked.current.get(key)?.element === element) tracked.current.delete(key);
      };
    },
    [],
  );
}

/**
 * Lights an element up for a moment, on top of its own background and
 * shadows. Used for rows and cells that just changed.
 */
export function flashElement(element: HTMLElement, color = "var(--flash)"): void {
  if (prefersReducedMotion() || typeof element.animate !== "function") return;
  // A flash still running would otherwise end up in the shadow we read below.
  for (const running of element.getAnimations()) if (running.id === FLASH_ID) running.cancel();
  const own = getComputedStyle(element).boxShadow;
  const rest = own && own !== "none" ? `, ${own}` : "";
  element.animate(
    [{ boxShadow: `inset 0 0 0 100vmax ${color}${rest}` }, { boxShadow: `inset 0 0 0 100vmax transparent${rest}` }],
    { id: FLASH_ID, duration: 1600, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
}

const FLASH_ID = "fw-flash";

// ------------------------------------------------------------- numbers --

/**
 * Counts a number up from `from` to its value when the component mounts after
 * the app has loaded, and from the old to the new value whenever it changes.
 * Writes straight into the element, so a count of a few hundred frames never
 * re-renders React.
 */
export function useCountUp<T extends HTMLElement>(
  value: number,
  format: (value: number) => string,
  { from = 0, duration = 900, onMount = true }: { from?: number; duration?: number; onMount?: boolean } = {},
): (element: T | null) => void {
  const element = useRef<T | null>(null);
  const shown = useRef<number | null>(null);
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });

  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    // Write into React's own text node, so React and this loop never disagree
    // about which node holds the number.
    const write = (text: string) => {
      const first = node.firstChild;
      if (first && first.nodeType === Node.TEXT_NODE) first.nodeValue = text;
      else node.textContent = text;
    };
    const previous = shown.current;
    shown.current = value;
    const start = previous ?? (onMount && isHydrated() ? from : value);
    if (start === value || prefersReducedMotion()) {
      // An interrupted count may have left another number in the node.
      write(formatRef.current(value));
      return;
    }
    let frame = 0;
    let displayed = start;
    const began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / duration);
      const eased = 1 - (1 - progress) ** 4;
      displayed = progress === 1 ? value : start + (value - start) * eased;
      // The formatter rounds to what it shows, so in-between values never overshoot.
      write(formatRef.current(displayed));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    write(formatRef.current(start));
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      // A new count (or React re-running the effect) continues from what is on screen.
      shown.current = displayed;
    };
  }, [value, from, duration, onMount]);

  return useCallback((node: T | null) => {
    element.current = node;
  }, []);
}
