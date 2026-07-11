"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "doctor",         label: "Doctor",     icon: "🩺" },
  { value: "researcher",     label: "Researcher", icon: "🔬" },
  { value: "hospital_admin", label: "Admin",      icon: "🏥" },
  { value: "hospital",       label: "Hospital",   icon: "🏨" },
];

const SPECIALTIES = [
  "Cardiology","Neurology","Oncology","Endocrinology","Infectious Disease",
  "Pulmonology","Gastroenterology","Nephrology","Rheumatology","Hematology",
  "Pediatrics","Radiology","Pathology","Surgery","Emergency Medicine",
  "Internal Medicine","Psychiatry","Dermatology","Ophthalmology","Urology",
  "Orthopedics","Immunology","Genetics","Other",
];

const COUNTRIES = [
  "India","United States","United Kingdom","Germany","Japan","Brazil",
  "France","Canada","Australia","South Korea","China","Italy","Spain",
  "Netherlands","Sweden","Singapore","South Africa","Mexico","Argentina","Other",
];

const HOSPITAL_TYPES = [
  "General Hospital","Teaching Hospital","Specialty Hospital","Children's Hospital",
  "Rehabilitation Centre","Research Institute","Multi-specialty Hospital","Other",
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({
    // Step 1
    full_name: "",
    email: "",
    password: "",
    role: "doctor",
    // Step 2 – shared
    hospital_name: "",
    hospital_country: "",
    hospital_city: "",
    specialty: "",
    orcid_id: "",
    bio: "",
    // Step 2 – hospital-specific
    hospital_type: "",
    registration_number: "",
    hospital_website: "",
    hospital_beds: "",
    contact_name: "",
    contact_phone: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});

  const update = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: "" }));
    setError("");
  };

  const isHospital = form.role === "hospital";

  const validateStep1 = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = "Full name is required.";
    if (!form.email.includes("@")) errs.email = "Enter a valid email.";
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (isHospital) {
      if (!form.hospital_name.trim())       errs.hospital_name = "Hospital name is required.";
      if (!form.hospital_country)           errs.hospital_country = "Country is required.";
      if (!form.hospital_type)              errs.hospital_type = "Hospital type is required.";
      if (!form.registration_number.trim()) errs.registration_number = "Registration number is required.";
      if (!form.contact_name.trim())        errs.contact_name = "Contact person name is required.";
    } else {
      if (!form.hospital_name.trim()) errs.hospital_name = "Hospital / institution name is required.";
      if (!form.hospital_country)     errs.hospital_country = "Country is required.";
      if (form.role !== "hospital_admin" && !form.specialty) errs.specialty = "Specialty is required.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => { if (validateStep1()) setStep(2); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);
    setError("");
    try {
      const payload = isHospital
        ? {
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            role: "hospital_admin",
            hospital_name: form.hospital_name,
            hospital_country: form.hospital_country,
            hospital_city: form.hospital_city || null,
            hospital_type: form.hospital_type,
            registration_number: form.registration_number,
            hospital_website: form.hospital_website || null,
            hospital_beds: form.hospital_beds ? parseInt(form.hospital_beds) : null,
            contact_name: form.contact_name,
            contact_phone: form.contact_phone || null,
          }
        : {
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            role: form.role,
            hospital_name: form.hospital_name,
            hospital_country: form.hospital_country,
            hospital_city: form.hospital_city || null,
            specialty: form.specialty || null,
            orcid_id: form.orcid_id || null,
            bio: form.bio || null,
          };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed. Please try again.");
      localStorage.setItem("medidata_token", data.access_token);
      localStorage.setItem("medidata_user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left panel */}
      <div className="auth-left">
        <div className="auth-left__brand">
          {/* SVG Logo */}
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
            <rect width="34" height="34" rx="9" fill="rgba(255,255,255,0.25)" />
            <path d="M10 17h4l2-6 3 12 2-6h3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="24" cy="11" r="2.5" fill="white" opacity="0.7"/>
          </svg>
          <span className="logo-text" style={{ color: "white" }}>MediData</span>
        </div>
        <div className="auth-left__content">
          <div className="auth-left__tagline">
            {isHospital
              ? "Register your institution on the global discovery network."
              : "Join a network where every case can save a life."}
          </div>
          <p className="auth-left__sub">
            {isHospital
              ? "Connect your hospital to share anonymised clinical insights with verified researchers and institutions worldwide."
              : "Your hospital's insights contribute to global medical discovery — all without a single patient record leaving your walls."}
          </p>
        </div>
        <div className="auth-left__illustration">
          <div className="auth-mini-card">
            <div className="auth-mini-icon">🛡️</div>
            <div>
              <div className="auth-mini-text">Zero patient exposure</div>
              <div className="auth-mini-sub">Records stay in your hospital</div>
            </div>
          </div>
          <div className="auth-mini-card">
            <div className="auth-mini-icon">🧬</div>
            <div>
              <div className="auth-mini-text">Rare disease detection</div>
              <div className="auth-mini-sub">4.2× faster with AI matching</div>
            </div>
          </div>
          <div className="auth-mini-card">
            <div className="auth-mini-icon">🌐</div>
            <div>
              <div className="auth-mini-text">Global expert network</div>
              <div className="auth-mini-sub">Verified specialists worldwide</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-card">
          <h1 className="auth-card__title">
            {step === 1 ? "Create your account" : isHospital ? "Hospital details" : "About you & your institution"}
          </h1>
          <p className="auth-card__sub">
            {step === 1
              ? <> Already registered? <Link href="/login">Sign in</Link></>
              : isHospital
                ? "Tell us about your hospital so we can verify and connect you."
                : "We need a few details to set up your profile."}
          </p>

          {/* Step indicator */}
          <div className="step-indicator">
            <div className={`step-dot ${step >= 1 ? (step > 1 ? "done" : "active") : ""}`}>
              {step > 1 ? "✓" : "1"}
            </div>
            <div className={`step-line ${step > 1 ? "done" : ""}`} />
            <div className={`step-dot ${step >= 2 ? "active" : ""}`}>2</div>
          </div>

          {error && <div className="auth-alert auth-alert--error">{error}</div>}

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div className="form-label" style={{ marginBottom: 10 }}>I am a</div>
                <div className="role-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                  {ROLES.map((r) => (
                    <div key={r.value}>
                      <input
                        type="radio" id={`role-${r.value}`} name="role"
                        value={r.value} className="role-option"
                        checked={form.role === r.value}
                        onChange={() => update("role", r.value)}
                      />
                      <label htmlFor={`role-${r.value}`} className="role-label">
                        <span className="role-icon">{r.icon}</span>
                        {r.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hospital display name vs person name */}
              <div className="form-group">
                <label className="form-label" htmlFor="full_name">
                  {isHospital ? "Your name (primary contact)" : "Full name"}
                </label>
                <input
                  id="full_name" name="full_name" type="text"
                  className={`form-input ${fieldErrors.full_name ? "error" : ""}`}
                  placeholder={isHospital ? "Dr. Priya Sharma" : "Dr. Priya Sharma"}
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  autoComplete="name"
                />
                {fieldErrors.full_name && <p className="form-error">{fieldErrors.full_name}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  {isHospital ? "Official hospital email" : "Email address"}
                </label>
                <input
                  id="email" name="email" type="email"
                  className={`form-input ${fieldErrors.email ? "error" : ""}`}
                  placeholder={isHospital ? "admin@hospital.org" : "you@hospital.org"}
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  autoComplete="email"
                />
                {fieldErrors.email && <p className="form-error">{fieldErrors.email}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <div className="form-input-wrap">
                  <input
                    id="password" name="password"
                    type={showPass ? "text" : "password"}
                    className={`form-input ${fieldErrors.password ? "error" : ""}`}
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" className="form-eye" onClick={() => setShowPass((v) => !v)}>
                    {showPass ? (
                      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && <p className="form-error">{fieldErrors.password}</p>}
              </div>

              <button type="button" className="btn-submit" onClick={handleNext}>
                Continue
              </button>
            </div>
          )}

          {/* ── Step 2 – Hospital ── */}
          {step === 2 && isHospital && (
            <form onSubmit={handleSubmit} noValidate>
              {/* Hospital name */}
              <div className="form-group">
                <label className="form-label" htmlFor="hospital_name">Hospital name</label>
                <input
                  id="hospital_name" name="hospital_name" type="text"
                  className={`form-input ${fieldErrors.hospital_name ? "error" : ""}`}
                  placeholder="Apollo Hospitals, Chennai"
                  value={form.hospital_name}
                  onChange={(e) => update("hospital_name", e.target.value)}
                />
                {fieldErrors.hospital_name && <p className="form-error">{fieldErrors.hospital_name}</p>}
              </div>

              {/* Type */}
              <div className="form-group">
                <label className="form-label" htmlFor="hospital_type">Hospital type</label>
                <select
                  id="hospital_type"
                  className={`form-select ${fieldErrors.hospital_type ? "error" : ""}`}
                  value={form.hospital_type}
                  onChange={(e) => update("hospital_type", e.target.value)}
                >
                  <option value="">Select type</option>
                  {HOSPITAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {fieldErrors.hospital_type && <p className="form-error">{fieldErrors.hospital_type}</p>}
              </div>

              {/* Registration number */}
              <div className="form-group">
                <label className="form-label" htmlFor="registration_number">Registration / licence number</label>
                <input
                  id="registration_number" name="registration_number" type="text"
                  className={`form-input ${fieldErrors.registration_number ? "error" : ""}`}
                  placeholder="MCI-2024-XXXXX"
                  value={form.registration_number}
                  onChange={(e) => update("registration_number", e.target.value)}
                />
                {fieldErrors.registration_number && <p className="form-error">{fieldErrors.registration_number}</p>}
                <p className="field-hint">Used for verification. Your certificate can be uploaded later in settings.</p>
              </div>

              {/* Country + City */}
              <div className="form-row">
                <div>
                  <label className="form-label" htmlFor="hospital_country">Country</label>
                  <select
                    id="hospital_country"
                    className={`form-select ${fieldErrors.hospital_country ? "error" : ""}`}
                    value={form.hospital_country}
                    onChange={(e) => update("hospital_country", e.target.value)}
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {fieldErrors.hospital_country && <p className="form-error">{fieldErrors.hospital_country}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="hospital_city">City <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
                  <input
                    id="hospital_city" name="hospital_city" type="text"
                    className="form-input" placeholder="Chennai"
                    value={form.hospital_city}
                    onChange={(e) => update("hospital_city", e.target.value)}
                  />
                </div>
              </div>

              {/* Contact person + phone */}
              <div className="form-row">
                <div>
                  <label className="form-label" htmlFor="contact_name">Contact person</label>
                  <input
                    id="contact_name" name="contact_name" type="text"
                    className={`form-input ${fieldErrors.contact_name ? "error" : ""}`}
                    placeholder="Dr. Priya Sharma"
                    value={form.contact_name}
                    onChange={(e) => update("contact_name", e.target.value)}
                  />
                  {fieldErrors.contact_name && <p className="form-error">{fieldErrors.contact_name}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="contact_phone">Phone <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
                  <input
                    id="contact_phone" name="contact_phone" type="tel"
                    className="form-input" placeholder="+91 98765 43210"
                    value={form.contact_phone}
                    onChange={(e) => update("contact_phone", e.target.value)}
                  />
                </div>
              </div>

              {/* Website + Beds */}
              <div className="form-row">
                <div>
                  <label className="form-label" htmlFor="hospital_website">Website <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
                  <input
                    id="hospital_website" name="hospital_website" type="url"
                    className="form-input" placeholder="https://hospital.org"
                    value={form.hospital_website}
                    onChange={(e) => update("hospital_website", e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="hospital_beds">Number of beds <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
                  <input
                    id="hospital_beds" name="hospital_beds" type="number"
                    className="form-input" placeholder="500"
                    value={form.hospital_beds}
                    onChange={(e) => update("hospital_beds", e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              {/* Verification notice */}
              <div style={{
                background: "var(--lavender-50)", border: "1px solid var(--lavender-200)",
                borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 18,
                fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 10, alignItems: "flex-start"
              }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ color: "var(--lavender-500)", marginTop: 2, flexShrink: 0 }}>
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                </svg>
                <span>Your registration will be reviewed within 2–3 business days. You'll receive an email once your hospital is verified on the network.</span>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? "Registering hospital…" : "Register hospital"}
              </button>
              <button type="button" className="btn-submit-secondary" onClick={() => setStep(1)} disabled={loading}>
                ← Back
              </button>
            </form>
          )}

          {/* ── Step 2 – Non-Hospital ── */}
          {step === 2 && !isHospital && (
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="hospital_name">
                  {form.role === "researcher" ? "Institution / University" : "Hospital name"}
                </label>
                <input
                  id="hospital_name" name="hospital_name" type="text"
                  className={`form-input ${fieldErrors.hospital_name ? "error" : ""}`}
                  placeholder={form.role === "researcher" ? "MIT, Anna University" : "Apollo Hospitals, Chennai"}
                  value={form.hospital_name}
                  onChange={(e) => update("hospital_name", e.target.value)}
                />
                {fieldErrors.hospital_name && <p className="form-error">{fieldErrors.hospital_name}</p>}
              </div>

              <div className="form-row">
                <div>
                  <label className="form-label" htmlFor="hospital_country">Country</label>
                  <select
                    id="hospital_country"
                    className={`form-select ${fieldErrors.hospital_country ? "error" : ""}`}
                    value={form.hospital_country}
                    onChange={(e) => update("hospital_country", e.target.value)}
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {fieldErrors.hospital_country && <p className="form-error">{fieldErrors.hospital_country}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="hospital_city">City <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
                  <input
                    id="hospital_city" name="hospital_city" type="text"
                    className="form-input" placeholder="Chennai"
                    value={form.hospital_city}
                    onChange={(e) => update("hospital_city", e.target.value)}
                  />
                </div>
              </div>

              {form.role !== "hospital_admin" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="specialty">Specialty</label>
                  <select
                    id="specialty"
                    className={`form-select ${fieldErrors.specialty ? "error" : ""}`}
                    value={form.specialty}
                    onChange={(e) => update("specialty", e.target.value)}
                  >
                    <option value="">Select specialty</option>
                    {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {fieldErrors.specialty && <p className="form-error">{fieldErrors.specialty}</p>}
                </div>
              )}

              {form.role === "researcher" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="orcid_id">
                    ORCID iD <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
                  </label>
                  <input
                    id="orcid_id" name="orcid_id" type="text"
                    className="form-input" placeholder="0000-0000-0000-0000"
                    value={form.orcid_id}
                    onChange={(e) => update("orcid_id", e.target.value)}
                  />
                  <p className="field-hint">Helps verify your academic identity later.</p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="bio">
                  Short bio <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input
                  id="bio" name="bio" type="text"
                  className="form-input"
                  placeholder="e.g. Cardiologist with 10 years in rare arrhythmias"
                  value={form.bio}
                  onChange={(e) => update("bio", e.target.value)}
                />
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </button>
              <button type="button" className="btn-submit-secondary" onClick={() => setStep(1)} disabled={loading}>
                ← Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}