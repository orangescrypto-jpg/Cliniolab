// components/NotificationPermissionBanner.tsx
// Shows a persistent "enable notifications" banner until the user
// either enables push or explicitly dismisses it. Unlike the PWA
// install prompt, this does NOT auto-reshow after a dismissal timeout
// by default, matching the request that it stay visible "until the
// user enables it" rather than nagging on a timer. If you want it to
// come back after N days even when dismissed, pass reshowAfterSec.
//
// Self-contained like DashboardAnnouncement — fetches its own Supabase
// session rather than requiring a token prop, so it's a drop-in:
// <NotificationPermissionBanner /> anywhere in an authenticated page.

"use client"

import { useEffect, useState, useCallback } from "react"
import { subscribeToPush } from "@/hooks/usePWA"
import { createClient } from "@/src/services/providers/supabase/client"

const DISMISSED_KEY = "zamoraxpay_push_banner_dismissed_at"
const ENABLED_KEY = "zamoraxpay_push_enabled"

interface NotificationPermissionBannerProps {
  /** If provided, the banner reappears this many seconds after a dismissal. Omit for "stays hidden once dismissed until enabled". */
  reshowAfterSec?: number
}

export function NotificationPermissionBanner({ reshowAfterSec }: NotificationPermissionBannerProps = {}) {
  const [visible, setVisible] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return

    // Already granted and already subscribed on this device — nothing to show.
    if (Notification.permission === "granted" && localStorage.getItem(ENABLED_KEY) === "true") {
      setVisible(false)
      return
    }

    // Permission was explicitly denied at the OS/browser level — showing
    // a banner that will just fail again is worse than not showing one,
    // since the only fix at that point is a manual browser settings change.
    if (Notification.permission === "denied") {
      setVisible(false)
      return
    }

    const dismissedAt = localStorage.getItem(DISMISSED_KEY)
    if (!dismissedAt) {
      setVisible(true)
      return
    }

    if (reshowAfterSec === undefined) {
      // No reshow window configured — stays hidden once dismissed, as requested.
      setVisible(false)
      return
    }

    const elapsed = (Date.now() - parseInt(dismissedAt, 10)) / 1000
    setVisible(elapsed > reshowAfterSec)
  }, [reshowAfterSec])

  const enable = useCallback(async () => {
    setEnabling(true)
    setError(null)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setEnabling(false)
      setError("Please log in again to enable notifications.")
      return
    }

    const success = await subscribeToPush(session.access_token)

    setEnabling(false)
    if (success) {
      localStorage.setItem(ENABLED_KEY, "true")
      setVisible(false)
    } else {
      setError("Couldn't enable notifications. Check your browser's notification permission and try again.")
    }
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString())
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-accent/10 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-secondary">Turn on notifications</p>
        <p className="text-xs text-muted-foreground">
          Get alerts for rewards, streaks, bonuses, and bill reminders.
        </p>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={enable}
          disabled={enabling}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {enabling ? "Enabling..." : "Enable"}
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-black/5"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
