"use client";

import { useState, useRef } from "react";
import SymptomInput from "./SymptomInput";
import LabResultsInput from "./LabResultsInput";
import { extractPdf, processCase, submitCase } from "@/lib/api/cases";
import { useAuthStore } from "@/store/useAuthStore";

// ── Constants ─────────────────────────────────────────────────────────────────

const AGE_RANGES = ["0-10","11-20","21-30","31-40","41-50","51-60","61-70","71-80","81+"];

const LAYER_LABELS = {
  "suppression":             { icon: "🚫", label: "Direct identifiers removed" },
  "k-anonymity":             { icon: "👥", label: "DOB → age bucket, address → region" },
  "split-key-tokenisation":  { icon: "🔑", label: "Patient ID split-key tokenised" },
  "differential-privacy":    { icon: "📊", label: "Lab values noise-adjusted" },
  "icd-10-mapping":          { icon: "🏥", label: "Symptoms mapped to ICD-10 codes" },
  "temporal-fuzzing":        { icon: "📅", label: "Dates generalised to week buckets" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function dobToAgeRange(dob) {
  if (!dob) return "";
  const parts = dob.split("/");
  if (parts.length < 3) return "";
  const [d, m, y] = parts.map(Number);
  const age = Math.floor((Date.now() - new Date(y, m - 1, d)) / (365.25 * 24 * 3600 * 1000));
  const buckets = [
    [0,10,"0-10"],[11,20,"11-20"],[21,30,"21-30"],[31,40,"31-40"],
    [41,50,"41-50"],[51,60,"51-60"],[61,70,"61-70"],[71,80,"71-80"],[81,200,"81+"],
  ];
  const match = buckets.find(([lo, hi]) => age >= lo && age <= hi);
  return match ? match[2] : "";
}

function normalizeSex(raw) {
  if (!raw) return "";
  const s = raw.toLowerCase();
  if (s === "male" || s === "m") return "male";
  if (s === "female" || s === "f") return "female";
  return "other";
}

function addressToCountry(address) {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim());
  return parts[parts.length - 1] || "";
}

function buildRawPayload({ form, symptoms, labResults, medications, procedures }) {
  return {
    age_range:              form.age_range,
    sex:                    form.sex,
    country:                form.country.trim(),
    clinical_notes_summary: form.clinical_notes_summary.trim() || null,
    outcome:                form.outcome || null,
    symptoms: symptoms
      .filter((s) => s.name.trim())
      .map((s) => ({ name: s.name.trim(), onset_day: s.onset_day === "" ? null : Number(s.onset_day) })),
    lab_results: labResults
      .filter((l) => l.marker.trim())
      .map((l) => ({ marker: l.marker.trim(), value: l.value.trim(), flag: l.flag || null })),
    medications: medications
      .filter((m) => m.name.trim())
      .map((m) => ({ name: m.name.trim(), response: m.response || null })),
    procedures:       procedures.map((p) => p.trim()).filter(Boolean),
    imaging_metadata: [],
    genomic_metadata: [],
  };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const removeBtnStyle = {
  flexShrink: 0, width: 38,
  border: "1.5px solid var(--lavender-100)",
  background: "var(--white)", color: "var(--text-muted)",
  borderRadius: 8, cursor: "pointer", fontSize: 13,
};

const addBtnStyle = {
  background: "none",
  border: "1.5px dashed var(--lavender-200)",
  color: "var(--lavender-600)",
  borderRadius: 8, padding: "8px 14px",
  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FormSection({ title, hint, children }) {
  return (
    <div style={{ background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 14, padding: 22, marginBottom: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14.5, fontWeight: 700, color: "var(--navy)" }}>{title}</div>
        {hint && <div className="field-hint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function FingerprintPreview({ fingerprint, layers_applied, onConfirm, onBack, submitting }) {
  return (
    <div style={{ background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 16, padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>
          Review de-identified record
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          This is what will be stored and indexed. No patient-identifiable information remains.
        </div>
      </div>

      {/* Privacy layers applied */}
      <div style={{ background: "var(--lavender-50)", border: "1px solid var(--lavender-100)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Privacy layers applied
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(layers_applied || []).map((layer) => {
            const meta = LAYER_LABELS[layer] || { icon: "✓", label: layer };
            return (
              <div key={layer} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)" }}>
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <span style={{ color: "#2e7d32", fontWeight: 600 }}>✓</span>
                <span>{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fingerprint JSON */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Stored fingerprint
        </div>
        <pre style={{
          background: "#f8f9fc",
          border: "1px solid var(--lavender-100)",
          borderRadius: 8,
          padding: "14px 16px",
          fontSize: 11.5,
          color: "#334",
          overflowX: "auto",
          maxHeight: 320,
          overflowY: "auto",
          lineHeight: 1.6,
          margin: 0,
          fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {JSON.stringify(fingerprint, null, 2)}
        </pre>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          style={{
            flex: 1,
            padding: "11px 0",
            border: "1.5px solid var(--lavender-200)",
            background: "var(--white)",
            color: "var(--navy)",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            opacity: submitting ? 0.5 : 1,
          }}
        >
          ← Edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="btn-submit"
          style={{ flex: 2, margin: 0 }}
        >
          {submitting ? "Submitting…" : "Confirm & submit"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Props:
 *   onSubmit {function} — called with the final CaseRead after successful submit
 */
export default function CaseForm({ onSubmit }) {
  const token = useAuthStore((state) => state.token);
  // Form state
  const [form, setForm] = useState({ age_range: "", sex: "", country: "", clinical_notes_summary: "", outcome: "" });
  const [symptoms, setSymptoms] = useState([{ name: "", onset_day: "" }]);
  const [labResults, setLabResults] = useState([{ marker: "", value: "", flag: "" }]);
  const [medications, setMedications] = useState([{ name: "", response: "" }]);
  const [procedures, setProcedures] = useState([""]);

  // Flow state: "form" | "preview" | "success"
  const [stage, setStage] = useState("form");

  // Preview data from /process
  const [preview, setPreview] = useState(null); // { fingerprint, token_H, layers_applied }

  // Status
  const [processing, setProcessing]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState(null);

  // PDF upload
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError]         = useState("");
  const [pdfFileName, setPdfFileName]   = useState("");
  const [autofillBanner, setAutofillBanner] = useState(false);
  const fileInputRef = useRef(null);

  // ── PDF autofill ────────────────────────────────────────────────────────────

  const handlePdfUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setPdfError("Please upload a PDF file."); return; }
    setPdfError("");
    setPdfFileName(file.name);
    setPdfUploading(true);
    setAutofillBanner(false);

    try {
      const data = await extractPdf(file);
      autofillForm(data.extracted);
      setAutofillBanner(true);
    } catch (err) {
      setPdfError(err.message || "Could not extract PDF.");
    } finally {
      setPdfUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const autofillForm = (data) => {
    setForm({
      age_range:              dobToAgeRange(data.dob) || "",
      sex:                    normalizeSex(data.sex) || "",
      country:                addressToCountry(data.address) || "",
      clinical_notes_summary: data.clinical_notes || "",
      outcome:                (data.outcome || "").toLowerCase() || "",
    });
    if (Array.isArray(data.symptoms) && data.symptoms.length > 0)
      setSymptoms(data.symptoms.map((s) => ({ name: s, onset_day: "" })));
    if (data.lab_results && typeof data.lab_results === "object") {
      const labs = Object.entries(data.lab_results).map(([marker, value]) => ({ marker, value: String(value), flag: "" }));
      if (labs.length > 0) setLabResults(labs);
    }
    if (Array.isArray(data.medications) && data.medications.length > 0)
      setMedications(data.medications.map((name) => ({ name, response: "" })));
    if (Array.isArray(data.procedures) && data.procedures.length > 0)
      setProcedures(data.procedures);
  };

  // ── Field handlers ──────────────────────────────────────────────────────────

  const handleField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const updateMedication = (idx, field, val) =>
    setMedications((meds) => meds.map((m, i) => (i === idx ? { ...m, [field]: val } : m)));
  const addMedication    = () => setMedications((m) => [...m, { name: "", response: "" }]);
  const removeMedication = (idx) => setMedications((m) => m.filter((_, i) => i !== idx));

  const updateProcedure = (idx, val) => setProcedures((p) => p.map((item, i) => (i === idx ? val : item)));
  const addProcedure    = () => setProcedures((p) => [...p, ""]);
  const removeProcedure = (idx) => setProcedures((p) => p.filter((_, i) => i !== idx));

  const resetForm = () => {
    setForm({ age_range: "", sex: "", country: "", clinical_notes_summary: "", outcome: "" });
    setSymptoms([{ name: "", onset_day: "" }]);
    setLabResults([{ marker: "", value: "", flag: "" }]);
    setMedications([{ name: "", response: "" }]);
    setProcedures([""]);
    setPdfFileName("");
    setAutofillBanner(false);
    setPdfError("");
    setPreview(null);
    setStage("form");
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    if (!form.age_range || !form.sex || !form.country.trim()) {
      setError("Please fill in age range, sex, and country.");
      return false;
    }
    const cleanedSymptoms = symptoms.filter((s) => s.name.trim());
    if (cleanedSymptoms.length === 0) {
      setError("Please add at least one symptom.");
      return false;
    }
    return true;
  };

  // ── Step 1: Process → preview ────────────────────────────────────────────────

  const handleProcess = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    const raw = buildRawPayload({ form, symptoms, labResults, medications, procedures });
    setProcessing(true);
    try {
      const result = await processCase(raw, token);
      setPreview(result);
      setStage("preview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Could not process case. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // ── Step 2: Confirm → submit ─────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!preview) return;
    setError("");
    setSubmitting(true);
    try {
      const created = await submitCase(preview.fingerprint, preview.token_H, token);
      setSuccess(created);
      setStage("success");
      if (onSubmit) onSubmit(created);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setStage("preview"); // stay on preview so the doctor can retry
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render: success ──────────────────────────────────────────────────────────

  if (stage === "success" && success) {
    return (
      <div style={{ background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>
          Case submitted
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 4 }}>
          De-identified, stored, and indexed for similarity search.
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24 }}>Case ID: {success.id}</div>
        <button type="button" onClick={() => { resetForm(); }} className="btn-submit" style={{ width: "auto", padding: "10px 24px" }}>
          Submit another case
        </button>
      </div>
    );
  }

  // ── Render: preview ──────────────────────────────────────────────────────────

  if (stage === "preview" && preview) {
    return (
      <>
        {error && <div className="auth-alert auth-alert--error" style={{ marginBottom: 16 }}>{error}</div>}
        <FingerprintPreview
          fingerprint={preview.fingerprint}
          layers_applied={preview.layers_applied}
          onConfirm={handleConfirm}
          onBack={() => { setStage("form"); setError(""); }}
          submitting={submitting}
        />
      </>
    );
  }

  // ── Render: form ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleProcess} noValidate>

      {/* Spin animation */}
      <style>{`@keyframes medidata-spin { to { transform: rotate(360deg); } }`}</style>

      {/* PDF Upload */}
      <div style={{ background: "var(--white)", border: "1.5px dashed var(--lavender-200)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14.5, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>
          Auto-fill from discharge PDF
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
          Upload a patient discharge summary and the fields below will be pre-populated. Review and edit before submitting.
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={pdfUploading}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: pdfUploading ? "var(--lavender-50)" : "var(--lavender-600, #4f46e5)",
              color: pdfUploading ? "var(--text-muted)" : "#fff",
              border: "none", borderRadius: 8, padding: "9px 18px",
              fontSize: 13, fontWeight: 600,
              cursor: pdfUploading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {pdfUploading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "medidata-spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
                Extracting…
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload PDF
              </span>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: "none" }} />
          {pdfFileName && !pdfUploading && (
            <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>📄 {pdfFileName}</span>
          )}
        </div>

        {pdfError && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#c0392b", background: "#fff5f5", border: "1px solid #fbb", borderRadius: 8, padding: "8px 12px" }}>
            {pdfError}
          </div>
        )}
        {autofillBanner && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#155724", background: "#d4edda", border: "1px solid #c3e6cb", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>✅ Fields auto-filled — review and correct if needed.</span>
            <button type="button" onClick={() => setAutofillBanner(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#155724", lineHeight: 1, padding: 0 }}>✕</button>
          </div>
        )}
      </div>

      {/* PII reminder */}
      <div style={{ background: "var(--lavender-50)", border: "1px solid var(--lavender-100)", borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 24, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
        <span>Only de-identified information is stored. Names, exact dates of birth, MRNs, and addresses are stripped before submission.</span>
      </div>

      {error && <div className="auth-alert auth-alert--error">{error}</div>}

      <FormSection title="Patient demographics">
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Age range</label>
            <select name="age_range" className="form-select" value={form.age_range} onChange={handleField}>
              <option value="">Select range</option>
              {AGE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sex</label>
            <select name="sex" className="form-select" value={form.sex} onChange={handleField}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Country</label>
          <input name="country" className="form-input" placeholder="e.g. India" value={form.country} onChange={handleField} />
        </div>
      </FormSection>

      <FormSection title="Symptoms" hint="At least one symptom is required.">
        <SymptomInput value={symptoms} onChange={setSymptoms} />
      </FormSection>

      <FormSection title="Lab results" hint="Optional — add any relevant markers.">
        <LabResultsInput value={labResults} onChange={setLabResults} />
      </FormSection>

      <FormSection title="Medications" hint="Optional.">
        {medications.map((med, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input className="form-input" placeholder="Medication name" value={med.name} onChange={(e) => updateMedication(idx, "name", e.target.value)} style={{ flex: 2 }} />
            <select className="form-select" value={med.response} onChange={(e) => updateMedication(idx, "response", e.target.value)} style={{ flex: 1 }}>
              <option value="">Response</option>
              <option value="full">Full</option>
              <option value="partial">Partial</option>
              <option value="none">None</option>
            </select>
            {medications.length > 1 && (
              <button type="button" onClick={() => removeMedication(idx)} aria-label="Remove medication" style={removeBtnStyle}>✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addMedication} style={addBtnStyle}>+ Add medication</button>
      </FormSection>

      <FormSection title="Procedures" hint="Optional.">
        {procedures.map((proc, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input className="form-input" placeholder="e.g. Chest X-ray" value={proc} onChange={(e) => updateProcedure(idx, e.target.value)} style={{ flex: 1 }} />
            {procedures.length > 1 && (
              <button type="button" onClick={() => removeProcedure(idx)} aria-label="Remove procedure" style={removeBtnStyle}>✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addProcedure} style={addBtnStyle}>+ Add procedure</button>
      </FormSection>

      <FormSection title="Clinical summary">
        <div className="form-group">
          <label className="form-label">De-identified clinical notes</label>
          <textarea
            name="clinical_notes_summary"
            className="form-input"
            placeholder="Brief de-identified summary of the case progression…"
            value={form.clinical_notes_summary}
            onChange={handleField}
            rows={4}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Outcome</label>
          <select name="outcome" className="form-select" value={form.outcome} onChange={handleField}>
            <option value="">Select outcome (optional)</option>
            <option value="recovered">Recovered</option>
            <option value="deteriorated">Deteriorated</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </div>
      </FormSection>

      <button type="submit" className="btn-submit" disabled={processing}>
        {processing ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "medidata-spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25" />
              <path d="M21 12a9 9 0 00-9-9" />
            </svg>
            Processing…
          </span>
        ) : (
          "Review de-identified record →"
        )}
      </button>
    </form>
  );
}