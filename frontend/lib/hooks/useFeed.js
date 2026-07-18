'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { listFeed, getFeedItem } from '@/lib/api/feed';

/**
 * Powers /feed. Handles pagination (loadMore), filtering, sorting, and refresh.
 */
export function useFeed({ limit = 12, signalType = null, sort = 'recent' } = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const offsetRef = useRef(0);

  const load = useCallback((reset) => {
    setLoading(true);
    setError(null);
    const offset = reset ? 0 : offsetRef.current;

    listFeed({ limit, offset, signalType, sort })
      .then((res) => {
        setTotal(res.total);
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        offsetRef.current = offset + res.items.length;
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit, signalType, sort]);

  // Re-fetch from scratch whenever the filter/sort/limit changes.
  useEffect(() => {
    offsetRef.current = 0;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalType, sort, limit]);

  const loadMore = () => load(false);
  const refresh = () => load(true);
  const hasMore = items.length < total;

  return { items, total, loading, error, hasMore, loadMore, refresh };
}

/**
 * Powers /feed with true numbered pagination (page 1, 2, 3…) instead of
 * infinite "load more" — each page swaps the item set rather than
 * appending to it.
 */
export function useFeedPaged({ pageSize = 6, signalType = null, sort = 'recent' } = {}) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback((pageToLoad) => {
    setLoading(true);
    setError(null);
    const offset = (pageToLoad - 1) * pageSize;
    listFeed({ limit: pageSize, offset, signalType, sort })
      .then((res) => {
        setTotal(res.total);
        setItems(res.items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [pageSize, signalType, sort]);

  // Reset to page 1 whenever the filter/sort changes.
  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalType, sort, pageSize]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const refresh = () => load(page);
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  return { items, total, totalPages, page, goToPage, loading, error, refresh };
}
export function useFeedItem(signalId) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!signalId) return;
    setLoading(true);
    setError(null);
    getFeedItem(signalId)
      .then(setItem)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [signalId]);

  return { item, loading, error };
}