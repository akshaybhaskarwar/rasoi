import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * A recipe photo, fetched only when it is about to be seen.
 *
 * Why this exists instead of `<img src={...photo_base64}>`:
 *
 *  - The list endpoints no longer ship photo bytes. A page of 20 recipes used
 *    to carry ~20 base64 photos (megabytes); now it carries 20 booleans, and
 *    each card asks for its own photo.
 *  - The photo endpoint answers with real image bytes and a long
 *    Cache-Control, so the second time a card renders, the browser serves it
 *    from cache with no network at all. A base64 string inside a JSON body
 *    can never be cached that way.
 *
 * Why a blob fetch rather than a plain `<img src>` (which would get native
 * loading="lazy" and caching for free): the endpoint is authenticated with a
 * bearer token, and `<img>` cannot send headers. Putting the token in the URL
 * instead would leak it into Cloudflare logs and browser history. So the
 * fetch carries the header and the result becomes an object URL — and
 * IntersectionObserver stands in for loading="lazy".
 */
export const RecipePhoto = ({
  recipeId,
  version,
  alt = '',
  className = '',
  eager = false,
  onUnavailable,
}) => {
  const [objectUrl, setObjectUrl] = useState(null);
  // `eager` skips the observer entirely — the detail view's photo is the
  // reason the user opened the sheet, so waiting for an intersection would
  // just add a frame of blank space.
  const [inView, setInView] = useState(eager);
  const holderRef = useRef(null);

  // Held in a ref, not read as an effect dependency: callers pass an inline
  // arrow (`onUnavailable={() => ...}`), whose identity changes on every
  // parent render — as a dependency it would re-run the fetch effect on each
  // render and churn object URLs.
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    if (eager || inView) return;
    const node = holderRef.current;
    if (!node) return;

    // No IntersectionObserver (old WebView) → load immediately rather than
    // never showing the photo at all.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      // Start fetching a screen before the card is reached so scrolling
      // doesn't reveal a column of empty boxes.
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, inView]);

  useEffect(() => {
    if (!inView || !recipeId) return;

    let cancelled = false;
    let created = null;

    const load = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await axios.get(`${API}/api/recipes/${recipeId}/photo`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          // The cache buster is the recipe's updated_at: replacing a photo
          // changes the URL, so the immutable cache entry is bypassed
          // instead of serving the old picture forever.
          params: version ? { v: version } : undefined,
          responseType: 'blob',
        });
        if (cancelled) return;
        created = URL.createObjectURL(res.data);
        setObjectUrl(created);
      } catch (error) {
        // 404 just means "this recipe has no photo" — the caller falls back
        // to its own placeholder, so this is not worth a console error.
        if (!cancelled) onUnavailableRef.current?.();
      }
    };

    load();

    return () => {
      cancelled = true;
      // Object URLs are not garbage collected on their own. Revoking on
      // unmount keeps a long scroll through the community feed from pinning
      // every photo it passed in memory; the HTTP cache still makes a
      // re-mount cheap.
      if (created) URL.revokeObjectURL(created);
    };
  }, [inView, recipeId, version]);

  if (objectUrl) {
    return <img src={objectUrl} alt={alt} className={className} />;
  }

  // Holder keeps layout stable (and gives the observer something to watch)
  // while the photo is still on its way.
  return <div ref={holderRef} className={className} aria-hidden="true" />;
};

export default RecipePhoto;
