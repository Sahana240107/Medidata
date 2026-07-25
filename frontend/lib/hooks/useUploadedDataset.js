'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'research.uploadedDatasets'; // { datasets: [...], activeDatasetId: string|null }
const EVENT_NAME = 'research:uploaded-datasets-changed';

function readStored() {
  if (typeof window === 'undefined') return { datasets: [], activeDatasetId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { datasets: [], activeDatasetId: null };
    const parsed = JSON.parse(raw);
    return {
      datasets: Array.isArray(parsed.datasets) ? parsed.datasets : [],
      activeDatasetId: parsed.activeDatasetId ?? null,
    };
  } catch {
    return { datasets: [], activeDatasetId: null };
  }
}

function writeStored(value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota/serialization errors — selection just won't persist
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
}

/**
 * Tracks every dataset the user has uploaded this session (id, filename,
 * row_count, columns, preview rows) plus which one is "active" for the
 * engine run panel. Shared across every component on the page via
 * localStorage + a custom event, so the upload panel and the engine run
 * panel (which may not be siblings) stay in sync without a context provider.
 */
export function useUploadedDataset() {
  const [state, setState] = useState(() => readStored());

  useEffect(() => {
    const onChange = (e) => setState(e.detail ?? readStored());
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setState(readStored()); };
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const addDataset = useCallback((newDataset) => {
    setState((prev) => {
      const withoutDup = prev.datasets.filter((d) => d.datasetId !== newDataset.datasetId);
      const next = {
        datasets: [...withoutDup, newDataset],
        activeDatasetId: newDataset.datasetId, // newly-uploaded dataset becomes active
      };
      writeStored(next);
      return next;
    });
  }, []);

  const setActiveDatasetId = useCallback((datasetId) => {
    setState((prev) => {
      const next = { ...prev, activeDatasetId: datasetId };
      writeStored(next);
      return next;
    });
  }, []);

  const removeDataset = useCallback((datasetId) => {
    setState((prev) => {
      const datasets = prev.datasets.filter((d) => d.datasetId !== datasetId);
      const activeDatasetId = prev.activeDatasetId === datasetId
        ? (datasets[datasets.length - 1]?.datasetId ?? null)
        : prev.activeDatasetId;
      const next = { datasets, activeDatasetId };
      writeStored(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    const next = { datasets: [], activeDatasetId: null };
    writeStored(next);
    setState(next);
  }, []);

  const activeDataset = useMemo(
    () => state.datasets.find((d) => d.datasetId === state.activeDatasetId) || null,
    [state.datasets, state.activeDatasetId]
  );

  return {
    datasets: state.datasets,
    activeDatasetId: state.activeDatasetId,
    activeDataset,
    // back-compat alias: existing callers reading `dataset` get the active one
    dataset: activeDataset,
    addDataset,
    setActiveDatasetId,
    removeDataset,
    clearAll,
  };
}