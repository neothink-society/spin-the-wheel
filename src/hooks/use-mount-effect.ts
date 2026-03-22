import { useEffect } from "react"

/**
 * Runs an effect exactly once on mount, with optional cleanup on unmount.
 * This is the ONLY allowed way to call useEffect in this codebase.
 *
 * Use for one-time external system sync: DOM integration, subscriptions,
 * third-party widget lifecycles, browser API setup.
 *
 * @see https://www.factory.ai/blog/why-we-banned-useeffect
 */
export function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, [])
}
