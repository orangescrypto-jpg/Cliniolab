'use client';

import { getSupabaseBrowserClient } from '@/lib/auth/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * All Supabase Realtime channel logic lives here so components never call
 * supabase.channel(...) directly. Channels broadcast app-level events
 * (e.g. 'new_comment', 'new_attempt') that a Cloudflare Worker/D1 write
 * path publishes after committing to D1 - D1 itself has no native
 * realtime, so Supabase broadcast is used purely as the pub/sub layer.
 */

export function subscribeToQuizComments(
  quizId: string,
  onNewComment: (payload: unknown) => void
): RealtimeChannel {
  const supabase = getSupabaseBrowserClient();
  const channel = supabase
    .channel(`quiz-comments-${quizId}`)
    .on('broadcast', { event: 'new_comment' }, ({ payload }) => onNewComment(payload))
    .subscribe();
  return channel;
}

export function subscribeToLeaderboard(
  scope: 'general' | string, // 'general' or a categoryId
  onUpdate: (payload: unknown) => void
): RealtimeChannel {
  const supabase = getSupabaseBrowserClient();
  const channelName = scope === 'general' ? 'leaderboard-general' : `leaderboard-category-${scope}`;
  const channel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'leaderboard_update' }, ({ payload }) => onUpdate(payload))
    .subscribe();
  return channel;
}

export function unsubscribe(channel: RealtimeChannel): void {
  const supabase = getSupabaseBrowserClient();
  supabase.removeChannel(channel);
}

/** Publishes a broadcast event on a channel - called after a successful API write. */
export async function publishEvent(
  channelName: string,
  event: string,
  payload: unknown
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const channel = supabase.channel(channelName);
  await channel.send({ type: 'broadcast', event, payload });
}
