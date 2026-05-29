import { createRealtimeSubscription } from '../../hooks/use-realtime-channel.js';
import { getSupabaseClient } from '../../services/supabase.service.js';
import { normalizeMatchFromSupabase } from '../../services/match.service.js';

export function createMatchDetailsRealtime({
  matchId,
  onUpdate,
  onDelete,
  onStatus,
  client = getSupabaseClient(),
}) {
  if (!client || !matchId) {
    return { channel: null, unsubscribe: async () => {} };
  }

  return createRealtimeSubscription({
    client,
    channelName: `match_updates_${matchId}`,
    postgresChanges: [
      {
        event: 'UPDATE',
        table: 'fm_partidas',
        filter: `id=eq.${matchId}`,
        handler: (payload) => {
          if (!payload?.new) return;
          onUpdate?.(normalizeMatchFromSupabase(payload.new));
        },
      },
      {
        event: 'DELETE',
        table: 'fm_partidas',
        filter: `id=eq.${matchId}`,
        handler: () => {
          onDelete?.();
        },
      },
    ],
    onStatus,
  });
}
