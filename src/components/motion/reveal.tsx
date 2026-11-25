"use client";

import { createElement, useCallback, type ReactNode } from "react";
import { prefersReducedMotion } from "@/hooks/use-motion";

/**
 * Lets an element rise into view the first time it scrolls into the screen.
 *
 * Nothing is hidden before the page is interactive: the server renders every
 * element visible, and only elements that are still below the fold once the
 * page runs are tucked away (where nobody sees it happen) until they arrive.
 * The styles are `[data-reveal]` in globals.css.
 */
export function useReveal<T extends HTMLElement>(): (element: T | null) => void | (() => void) {
  return useCallback((element: T | null) => {
    if (!element || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    const bounds = element.getBoundingClientRect();
    if (bounds.top < window.innerHeight && bounds.bottom > 0) return;
    element.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        element.dataset.reveal = "shown";
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
}

interface RevealProps {
  children: ReactNode;
  as?: "div" | "section" | "li" | "article";
  className?: string;
}

/** A wrapper that rises into view; usable from server components. */
export function Reveal({ children, as = "div", className }: RevealProps) {
  const ref = useReveal<HTMLElement>();
  return createElement(as, { ref, className }, children);
}
