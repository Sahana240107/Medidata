"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const stats = [
  { value: "2.3B+", label: "Patient fingerprints indexed" },
  { value: "140+", label: "Hospitals worldwide" },
  { value: "98.7%", label: "Privacy preservation rate" },
  { value: "4.2x", label: "Faster rare disease detection" },
];

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 11.99c0 2.04.51 3.956 1.406 5.63M15 17.25A3.75 3.75 0 0012 21a3.75 3.75 0 01-3-1.5M21 11.99c0 2.04-.51 3.956-1.406 5.63M15 17.25l-1.406 1.406M9 17.25l1.406 1.406" />
      </svg>
    ),
    title: "Zero Patient Exposure",
    desc: "Patient records never leave your hospital. Only irreversible medical fingerprints are shared across the network.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Instant Case Matching",
    desc: "Upload a difficult case and receive matched cases from hospitals worldwide within seconds.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    title: "Research Signal Discovery",
    desc: "AI continuously scans the network to surface emerging syndromes, drug responses, and rare disease clusters.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197" />
      </svg>
    ),
    title: "Global Expert Network",
    desc: "Connect with verified specialists who have managed similar cases — across borders, without compromising privacy.",
  },
];

const howItWorks = [
  { step: "01", title: "Hospital joins MediData", desc: "Deploy a local MediData Node. It stays inside your infrastructure." },
  { step: "02", title: "Cases become fingerprints", desc: "The node de-identifies records and generates multi-dimensional medical embeddings." },
  { step: "03", title: "Network discovers patterns", desc: "The AI discovery engine clusters fingerprints to surface research signals." },
  { step: "04", title: "Doctors act on insights", desc: "Clinicians receive case matches, expert connections, and collaboration opportunities." },
];

function AnimatedCounter({ value, label, visible }) {
  const [count, setCount] = useState(0);
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ""));
  const suffix = value.replace(/[0-9.]/g, "");

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const duration = 1800;
    const steps = 60;
    const increment = numericValue / steps;
    const timer = setInterval(() => {
      start += increment;
      if (start >= numericValue) {
        setCount(numericValue);
        clearInterval(timer);
      } else {
        setCount(parseFloat(start.toFixed(1)));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [visible, numericValue]);

  const display = numericValue % 1 === 0 ? Math.round(count) : count.toFixed(1);

  return (
    <div className="stat-card">
      <div className="stat-value">{display}{suffix}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing">
      {/* Nav */}
      <nav className={`nav ${scrollY > 20 ? "nav--scrolled" : ""}`}>
        <div className="nav__inner">
          <div className="nav__logo">
            <span className="logo-mark">M</span>
            <span className="logo-text">MediData</span>
          </div>
          <div className="nav__links">
            <a href="#how-it-works" className="nav__link">How it works</a>
            <a href="#features" className="nav__link">Features</a>
            <Link href="/login" className="nav__cta-ghost">Sign in</Link>
            <Link href="/signup" className="nav__cta">Get access</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero__bg">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`orb orb--${i + 1}`} />
          ))}
        </div>
        <div className="hero__content">
          <div className="hero__badge">
            <span className="badge-dot" />
            Privacy-Preserving Medical Discovery
          </div>
          <h1 className="hero__title">
            The world's clinical knowledge.<br />
            <span className="hero__title--accent">No patient data leaves.</span>
          </h1>
          <p className="hero__subtitle">
            MediData connects hospitals globally through irreversible medical fingerprints — enabling rare disease detection, research collaboration, and expert matching without exposing a single patient record.
          </p>
          <div className="hero__actions">
            <Link href="/signup" className="btn btn--primary btn--lg">
              Join the network
              <svg viewBox="0 0 20 20" fill="currentColor" className="btn__icon">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </Link>
            <a href="#how-it-works" className="btn btn--ghost btn--lg">See how it works</a>
          </div>
          <div className="hero__trust">
            <span className="trust-label">Trusted by hospitals in</span>
            <div className="trust-flags">
              {["🇺🇸", "🇩🇪", "🇯🇵", "🇮🇳", "🇬🇧", "🇧🇷"].map((flag, i) => (
                <span key={i} className="trust-flag">{flag}</span>
              ))}
              <span className="trust-more">+134 countries</span>
            </div>
          </div>
        </div>

        {/* Floating card preview */}
        <div className="hero__visual">
          <div className="signal-card">
            <div className="signal-card__header">
              <div className="signal-dot signal-dot--live" />
              <span className="signal-label">Live Research Signal</span>
            </div>
            <div className="signal-card__title">Rare Multi-Organ Syndrome #847</div>
            <div className="signal-card__meta">
              <div className="signal-meta-item">
                <span className="meta-num">12</span>
                <span className="meta-label">matching cases</span>
              </div>
              <div className="signal-meta-divider" />
              <div className="signal-meta-item">
                <span className="meta-num">7</span>
                <span className="meta-label">hospitals</span>
              </div>
              <div className="signal-meta-divider" />
              <div className="signal-meta-item">
                <span className="meta-num">83%</span>
                <span className="meta-label">confidence</span>
              </div>
            </div>
            <div className="signal-card__bar">
              <div className="signal-bar-fill" style={{ width: "83%" }} />
            </div>
            <div className="signal-card__countries">
              <span className="country-tag">🇩🇪 Germany</span>
              <span className="country-tag">🇯🇵 Japan</span>
              <span className="country-tag">🇮🇳 India</span>
              <span className="country-tag">+4 more</span>
            </div>
          </div>

          <div className="match-card">
            <div className="match-card__header">Case Match Found</div>
            <div className="match-card__score">
              <svg viewBox="0 0 36 36" className="match-ring">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e8eaf6" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#5c6bc0" strokeWidth="3"
                  strokeDasharray="94.25" strokeDashoffset="15.9" strokeLinecap="round" transform="rotate(-90 18 18)" />
              </svg>
              <span className="match-percent">83%</span>
            </div>
            <div className="match-card__detail">Similar presentation from Tokyo General Hospital</div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section" ref={statsRef}>
        <div className="stats-inner">
          {stats.map((s, i) => (
            <AnimatedCounter key={i} value={s.value} label={s.label} visible={statsVisible} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="section" id="how-it-works">
        <div className="section__container">
          <div className="section__label">The process</div>
          <h2 className="section__title">How MediData works</h2>
          <p className="section__subtitle">From local EHR to global insight — privacy guaranteed at every step.</p>
          <div className="steps">
            {howItWorks.map((item, i) => (
              <div key={i} className="step">
                <div className="step__number">{item.step}</div>
                <div className="step__connector" style={{ visibility: i < howItWorks.length - 1 ? "visible" : "hidden" }} />
                <h3 className="step__title">{item.title}</h3>
                <p className="step__desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section section--alt" id="features">
        <div className="section__container">
          <div className="section__label">Capabilities</div>
          <h2 className="section__title">Built for real clinical workflows</h2>
          <p className="section__subtitle">Every feature is designed around the trust and privacy requirements of modern healthcare.</p>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-card__icon">{f.icon}</div>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-title">Ready to accelerate discovery?</h2>
          <p className="cta-subtitle">Join hospitals already contributing to the world's largest privacy-preserving clinical network.</p>
          <Link href="/signup" className="btn btn--primary btn--xl">
            Create your account
          </Link>
          <p className="cta-fine">No patient data leaves your institution. Ever.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__logo">
            <span className="logo-mark">M</span>
            <span className="logo-text">MediData</span>
          </div>
          <p className="footer__copy">© 2025 MediData. Privacy-preserving global medical discovery.</p>
        </div>
      </footer>
    </div>
  );
}