/**
 * FavoriteChannelsContext — single source of truth for the user's favorite
 * YouTube channels, shared across every component that touches them
 * (PlannerPage's chip card, PersonalizedRecipeStream's avatar bar, etc.).
 *
 * Before this context existed, PlannerPage and PersonalizedRecipeStream each
 * maintained their own copy of the channels list via separate fetches. Adding
 * a channel via the planner's card updated PlannerPage's copy but left
 * PersonalizedRecipeStream's avatar bar stale until a full page refresh.
 *
 * The context fetches from `/api/stream/channels` (which already reads from
 * preferences AND enriches each channel with YouTube metadata — thumbnail,
 * upload-playlist ID — needed by the avatar UI). After add/remove (which hit
 * `/api/preferences/favorite-channels`), we re-fetch to pick up the enrichment
 * so every consumer sees the updated, enriched list.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FavoriteChannelsContext = createContext(null);

export const FavoriteChannelsProvider = ({ children }) => {
  const [favoriteChannels, setFavoriteChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `/stream/channels` reads preferences AND enriches with YouTube
      // metadata (thumbnail, channel_id, uploads_playlist_id) needed by
      // the avatar UI. A 7-day server-side cache keeps it cheap.
      const response = await axios.get(`${API}/stream/channels`);
      setFavoriteChannels(response.data.channels || []);
    } catch (err) {
      // Fallback to the bare preferences endpoint so the chip-row UI still
      // works even when the enrichment endpoint fails (e.g., YouTube quota).
      try {
        const fallback = await axios.get(`${API}/preferences/favorite-channels`);
        setFavoriteChannels(fallback.data.favorite_channels || []);
      } catch (fbErr) {
        console.error('Fetch favorite channels failed (both endpoints):', err, fbErr);
        setError(err.message);
        setFavoriteChannels([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const addFavoriteChannel = useCallback(async (channelId, channelName) => {
    try {
      await axios.post(`${API}/preferences/favorite-channels`, {
        channel_id: channelId,
        channel_name: channelName,
      });
      // Re-fetch from /stream/channels so the new entry gets the same
      // thumbnail/playlist enrichment as everyone else.
      await refresh();
    } catch (err) {
      console.error('Add favorite channel error:', err);
      setError(err.message);
      throw err;
    }
  }, [refresh]);

  const removeFavoriteChannel = useCallback(async (channelId) => {
    try {
      await axios.delete(`${API}/preferences/favorite-channels/${channelId}`);
      // Optimistic local removal so the UI feels instant. The next refresh
      // (or another add) will reconcile if anything drifted.
      setFavoriteChannels(prev => prev.filter(ch => ch.id !== channelId));
    } catch (err) {
      console.error('Remove favorite channel error:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = {
    favoriteChannels,
    loading,
    error,
    refresh,
    addFavoriteChannel,
    removeFavoriteChannel,
    // Back-compat alias for any old caller that referenced this name.
    fetchFavoriteChannels: refresh,
  };

  return (
    <FavoriteChannelsContext.Provider value={value}>
      {children}
    </FavoriteChannelsContext.Provider>
  );
};

/**
 * Hook to consume the shared favorite-channels state.
 *
 * Same signature as the old useFavoriteChannels hook from useRasoiSync.js
 * so existing call sites (PlannerPage etc.) don't need import changes —
 * they just need to re-export from this module.
 */
export const useFavoriteChannels = () => {
  const ctx = useContext(FavoriteChannelsContext);
  if (!ctx) {
    throw new Error(
      'useFavoriteChannels must be used inside a <FavoriteChannelsProvider>. ' +
      'Mount the provider in App.js under the authenticated route.'
    );
  }
  return ctx;
};
