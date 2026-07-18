'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { listExperts, getExpertFilters, getNetworkActivity } from '@/lib/api/experts';
import { createCollaboration } from '@/lib/api/collaborations';
import ExpertCard from '@/components/experts/ExpertCard';
import ExpertFilterBar from '@/components/experts/ExpertFilterBar';
import NetworkActivityTable from '@/components/experts/NetworkActivityTable';
import CollaborationRequestModal from '@/components/collaborations/CollaborationRequestModal';

export default function ExpertsPage() {
  const router = useRouter();

  const [experts, setExperts] = useState([]);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState(null);
  const [networkActivity, setNetworkActivity] = useState([]);

  const [filters, setFilters] = useState({ specialty: '', country: '', sort: 'cases' });
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [modal, setModal] = useState({ open: false, expert: null, kind: 'collaborate' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listExperts({ ...filters, search: search || null })
      .then((res) => {
        setExperts(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message || 'Could not load experts.'))
      .finally(() => setLoading(false));
  }, [filters, search]);

  useEffect(() => {
    const handle = setTimeout(load, 250); // debounce search/filter changes
    return () => clearTimeout(handle);
  }, [load]);

  useEffect(() => {
    getExpertFilters().then(setFilterOptions).catch(() => {});
    getNetworkActivity(8).then(setNetworkActivity).catch(() => {});
  }, []);

  const refreshOne = (expertId, patch) => {
    setExperts((prev) => prev.map((e) => (e.id === expertId ? { ...e, ...patch } : e)));
  };

  const handleConnect = async (expert) => {
    setBusyId(expert.id);
    setError(null);
    try {
      const collab = await createCollaboration({ requestedTo: expert.id, kind: 'connect' });
      refreshOne(expert.id, { connection_status: 'pending_sent', collaboration_id: collab.id });
    } catch (err) {
      setError(err.message || 'Could not send connection request.');
    } finally {
      setBusyId(null);
    }
  };

  const openModal = (expert, kind) => setModal({ open: true, expert, kind });
  const closeModal = () => setModal({ open: false, expert: null, kind: 'collaborate' });

  const handleModalSubmit = async ({ message, projectTitle }) => {
    const { expert, kind } = modal;
    setSubmitting(true);
    setError(null);
    try {
      const collab = await createCollaboration({
        requestedTo: expert.id,
        message,
        kind,
        projectTitle,
      });
      refreshOne(expert.id, { connection_status: 'pending_sent', collaboration_id: collab.id });
      closeModal();
    } catch (err) {
      setError(err.message || 'Could not send request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMessage = (expert) => {
    router.push(`/collaborations?open=${expert.collaboration_id}`);
  };

  return (
    <>
      <header
        style={{
          padding: '16px 32px',
          background: 'var(--white)',
          borderBottom: '1px solid var(--lavender-100)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 30,
          boxShadow: '0 1px 8px rgba(92,107,192,0.06)',
        }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
            Experts
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>
            Verified doctors and researchers on MediData{total ? ` \u00b7 ${total} profiles` : ''}
          </div>
        </div>
      </header>

      <div style={{ padding: '28px 32px' }}>
        {error && (
          <div style={{ background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <ExpertFilterBar
          filters={filters}
          onChange={setFilters}
          filterOptions={filterOptions}
          search={search}
          onSearchChange={setSearch}
        />

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '20px 0' }}>Loading experts\u2026</div>
        ) : experts.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No experts match these filters yet.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
              marginBottom: 32,
            }}
          >
            {experts.map((expert, i) => (
              <ExpertCard
                key={expert.id}
                expert={expert}
                index={i}
                busy={busyId === expert.id}
                onConnect={handleConnect}
                onCollaborate={(e) => openModal(e, 'collaborate')}
                onInviteToStudy={(e) => openModal(e, 'invite_to_study')}
                onMessage={handleMessage}
              />
            ))}
          </div>
        )}

        <NetworkActivityTable rows={networkActivity} />
      </div>

      <CollaborationRequestModal
        open={modal.open}
        expert={modal.expert}
        kind={modal.kind}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        submitting={submitting}
      />
    </>
  );
}