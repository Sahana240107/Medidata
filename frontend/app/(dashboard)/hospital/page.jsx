'use client';

import { useEffect, useState } from 'react';
import { getHospitalInsights } from '@/lib/api/hospitals';
import HospitalProfileHeader from '@/components/hospital/HospitalProfileHeader';
import NetworkOverviewStrip from '@/components/hospital/NetworkOverviewStrip';
import HospitalRankCard from '@/components/hospital/HospitalRankCard';
import HospitalMetrics from '@/components/hospital/HospitalMetrics';
import HospitalAchievements from '@/components/hospital/HospitalAchievements';

function LoadingState() {
  const shimmer = { background: 'var(--lavender-50)', borderRadius: 'var(--radius-md)' };
  return (
    <div style={{ padding: '40px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ ...shimmer, height: 172, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ ...shimmer, height: 94 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div style={{ ...shimmer, height: 320 }} />
        <div style={{ ...shimmer, height: 320 }} />
      </div>
    </div>
  );
}

export default function HospitalInsightsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getHospitalInsights()
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load hospital insights.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div style={{ padding: '40px 48px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{
          background: '#fdeaea', color: '#c62828', borderRadius: 'var(--radius-sm)',
          padding: '14px 18px', fontSize: 13.5,
        }}>
          {error}
        </div>
      </div>
    );
  }

  const { network, leaderboard, hospital } = data || {};

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: 'var(--navy)',
          fontFamily: "'Sora', sans-serif", marginBottom: 6,
        }}>
          Hospital Insights
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--text-secondary)' }}>
          How the network is doing overall, and how your hospital fits into it
        </p>
      </div>

      <NetworkOverviewStrip network={network} />

      {hospital ? (
        <>
          <HospitalProfileHeader hospital={hospital} totalHospitals={network?.total_hospitals} />

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <HospitalMetrics hospital={hospital} />
              <HospitalAchievements achievements={hospital.achievements} />
            </div>

            <div style={{ minWidth: 0 }}>
              <HospitalRankCard leaderboard={leaderboard} />
            </div>
          </div>
        </>
      ) : (
        <div style={{
          color: 'var(--text-muted)', fontSize: 14, padding: '48px 0',
          textAlign: 'center', border: '1px dashed var(--lavender-200)',
          borderRadius: 'var(--radius-md)',
        }}>
          Your account isn't linked to a hospital yet, so we can't show hospital-level stats.
          You can still see the network overview above.
        </div>
      )}
    </div>
  );
}
