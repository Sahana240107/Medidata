'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  listCollaborations,
  respondToCollaboration,
  updateCollaborationProgress,
} from '@/lib/api/collaborations';
import CollaborationCard from '@/components/collaborations/CollaborationCard';
//import CollaborationChatPanel from '@/components/collaborations/CollaborationChatPanel';

const TABS = [
  { key: 'active', label: 'Active Contacts' },
  { key: 'incoming', label: 'Pending Requests' },
  { key: 'outgoing', label: 'Sent Requests' },
];

function CollaborationsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openId = searchParams.get('open');

  const [tab, setTab] = useState(openId ? 'active' : 'incoming');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [active, setActive] = useState([]);
  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      listCollaborations('incoming'),
      listCollaborations('outgoing'),
      listCollaborations('active'),
    ])
      .then(([inc, out, act]) => {
        setIncoming(inc);
        setOutgoing(out);
        setActive(act);
        if (openId) {
          const match = act.find((c) => c.id === openId);
          if (match) setSelected(match);
        }
      })
      .catch((err) => setError(err.message || 'Could not load collaborations.'))
      .finally(() => setLoading(false));
  }, [openId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAccept = async (collab) => {
    setBusyId(collab.id);
    setError(null);
    try {
      await respondToCollaboration(collab.id, 'accept');
      loadAll();
      setTab('active');
    } catch (err) {
      setError(err.message || 'Could not accept request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (collab) => {
    setBusyId(collab.id);
    setError(null);
    try {
      await respondToCollaboration(collab.id, 'decline');
      loadAll();
    } catch (err) {
      setError(err.message || 'Could not decline request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleProgressChange = async (collab, newPct) => {
    try {
      const updated = await updateCollaborationProgress(collab.id, newPct, collab.project_title);
      setActive((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (selected?.id === updated.id) setSelected(updated);
    } catch (err) {
      setError(err.message || 'Could not update progress.');
    }
  };

  const list = tab === 'incoming' ? incoming : tab === 'outgoing' ? outgoing : active;

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
            Collaborations
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>
            {active.length} active &middot; {incoming.length} pending request{incoming.length === 1 ? '' : 's'}
          </div>
        </div>
        <button
          onClick={() => router.push('/experts')}
          style={{
            marginLeft: 'auto',
            padding: '9px 16px',
            background: 'var(--lavender-600)',
            color: 'white',
            border: 'none',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Find Collaborators
        </button>
      </header>

      <div style={{ padding: '28px 32px' }}>
        {error && (
          <div style={{ background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {TABS.map((t) => {
            const count = t.key === 'incoming' ? incoming.length : t.key === 'outgoing' ? outgoing.length : active.length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: tab === t.key ? '1.5px solid var(--lavender-600)' : '1.5px solid var(--lavender-100)',
                  background: tab === t.key ? 'var(--lavender-600)' : 'white',
                  color: tab === t.key ? 'white' : 'var(--text-secondary)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading\u2026</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
            {/* Contacts list */}
            <div
              style={{
                background: 'white',
                border: '1px solid var(--lavender-100)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(92,107,192,0.06)',
              }}
            >
              {list.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {tab === 'incoming' && 'No pending requests.'}
                  {tab === 'outgoing' && 'No requests awaiting a response.'}
                  {tab === 'active' && 'No active collaborations yet \u2014 visit Experts to connect with someone.'}
                </div>
              ) : (
                list.map((collab) => (
                  <CollaborationCard
                    key={collab.id}
                    collab={collab}
                    variant={tab}
                    busy={busyId === collab.id}
                    selected={selected?.id === collab.id}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onOpenChat={setSelected}
                  />
                ))
              )}
            </div>

            {/* Right panel: chat, or active-projects overview */}
            <div style={{ height: 560 }}>
              {selected ? (
                <CollaborationChatPanel collaboration={selected} />
              ) : (
                <ActiveProjectsOverview active={active} onProgressChange={handleProgressChange} onOpenChat={setSelected} />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ActiveProjectsOverview({ active, onProgressChange, onOpenChat }) {
  const withProjects = active.filter((c) => c.project_title);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Active Projects</div>

      {withProjects.length === 0 ? (
        <div
          style={{
            background: 'var(--lavender-50)',
            borderRadius: 14,
            padding: '24px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          No projects with a title yet. Invite a collaborator "to Study" from the Experts page to start one, or select a
          connected contact on the left to chat.
        </div>
      ) : (
        withProjects.map((collab) => (
          <div
            key={collab.id}
            style={{
              background: 'white',
              border: '1px solid var(--lavender-100)',
              borderRadius: 14,
              padding: 18,
              boxShadow: '0 2px 8px rgba(92,107,192,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)' }}>{collab.project_title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  with {collab.counterpart.full_name}
                </div>
              </div>
              <button
                onClick={() => onOpenChat(collab)}
                style={{ fontSize: 11.5, color: 'var(--lavender-600)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Open chat &rarr;
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Progress</span><span>{collab.progress_percent}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: 'var(--lavender-100)', overflow: 'hidden', marginBottom: 10 }}>
              <div
                style={{
                  width: `${collab.progress_percent}%`,
                  height: '100%',
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, var(--lavender-500), var(--lavender-600))',
                  transition: 'width 1s ease',
                }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={collab.progress_percent}
              onChange={(e) => onProgressChange(collab, Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        ))
      )}
    </div>
  );
}

export default function CollaborationsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading\u2026</div>}>
      <CollaborationsPageInner />
    </Suspense>
  );
}