"use client";

import { useState } from "react";
import SymptomInput from "./SymptomInput";
import LabResultsInput from "./LabResultsInput";

const AGE_RANGES = ["0-10", "11-20", "21-30", "31-40", "41-50", "51-60", "61-70", "71-80", "81+"];

export default function CaseForm({ onSubmit }) {
  const [form, setForm] = useState({
    age_range: "",
    sex: "",
    country: "",
    clinical_notes_summary: "",
    outcome: "",
  });
  const [symptoms, setSymptoms] = useState([{ name: "", onset_day: "" }]);
  const [labResults, setLabResults] = useState([{ marker: "", value: "", flag: "" }]);
  const [medications, setMedications] = useState([{ name: "", response: "" }]);
  const [procedures, setProcedures] = useState([""]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const handleField = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const updateMedication = (idx, field, val) => {
    setMedications((meds) => meds.map((m, i) => (i === idx ? { ...m, [field]: val } : m)));
  };
  const addMedication = () => setMedications((m) => [...m, { name: "", response: "" }]);
  const removeMedication = (idx) => setMedications((m) => m.filter((_, i) => i !== idx));

  const updateProcedure = (idx, val) => {
    setProcedures((p) => p.map((item, i) => (i === idx ? val : item)));
  };
  const addProcedure = () => setProcedures((p) => [...p, ""]);
  const removeProcedure = (idx) => setProcedures((p) => p.filter((_, i) => i !== idx));

  const resetForm = () => {
    setForm({ age_range: "", sex: "", country: "", clinical_notes_summary: "", outcome: "" });
    setSymptoms([{ name: "", onset_day: "" }]);
    setLabResults([{ marker: "", value: "", flag: "" }]);
    setMedications([{ name: "", response: "" }]);
    setProcedures([""]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.age_range || !form.sex || !form.country.trim()) {
      setError("Please fill in age range, sex, and country.");
      return;
    }

    const cleanedSymptoms = symptoms
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        onset_day: s.onset_day === "" ? null : Number(s.onset_day),
      }));

    if (cleanedSymptoms.length === 0) {
      setError("Please add at least one symptom.");
      return;
    }

    const payload = {
      age_range: form.age_range,
      sex: form.sex,
      country: form.country.trim(),
      clinical_notes_summary: form.clinical_notes_summary.trim() || null,
      outcome: form.outcome || null,
      symptoms: cleanedSymptoms,
      lab_results: labResults
        .filter((l) => l.marker.trim())
        .map((l) => ({ marker: l.marker.trim(), value: l.value.trim(), flag: l.flag || null })),
      medications: medications
        .filter((m) => m.name.trim())
        .map((m) => ({ name: m.name.trim(), response: m.response || null })),
      procedures: procedures.map((p) => p.trim()).filter(Boolean),
      imaging_metadata: [],
      genomic_metadata: [],
    };

    setSubmitting(true);
    try {
      const created = await onSubmit(payload);
      setSuccess(created);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div
        style={{
          background: "var(--white)",
          border: "1.5px solid var(--lavender-100)",
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#e8f5e9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>
          Case submitted
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 4 }}>
          The case has been de-identified, stored, and indexed for similarity search.
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24 }}>
          Case ID: {success.id}
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setSuccess(null);
          }}
          className="btn-submit"
          style={{ width: "auto", padding: "10px 24px" }}
        >
          Submit another case
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* PII reminder */}
      <div
        style={{
          background: "var(--lavender-50)",
          border: "1px solid var(--lavender-100)",
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 12.5,
          color: "var(--text-secondary)",
          marginBottom: 24,
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
        <span>
          Only de-identified information. No patient names, exact dates of birth, MRNs, or other
          identifiers — use bucketed age ranges and hashed local references only.
        </span>
      </div>

      {error && <div className="auth-alert auth-alert--error">{error}</div>}

      {/* Demographics */}
      <FormSection title="Patient demographics">
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Age range</label>
            <select name="age_range" className="form-select" value={form.age_range} onChange={handleField}>
              <option value="">Select range</option>
              {AGE_RANGES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
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
          <input
            name="country"
            className="form-input"
            placeholder="e.g. India"
            value={form.country}
            onChange={handleField}
          />
        </div>
      </FormSection>

      {/* Symptoms */}
      <FormSection title="Symptoms" hint="At least one symptom is required.">
        <SymptomInput value={symptoms} onChange={setSymptoms} />
      </FormSection>

      {/* Lab results */}
      <FormSection title="Lab results" hint="Optional — add any relevant markers.">
        <LabResultsInput value={labResults} onChange={setLabResults} />
      </FormSection>

      {/* Medications */}
      <FormSection title="Medications" hint="Optional.">
        {medications.map((med, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input
              className="form-input"
              placeholder="Medication name"
              value={med.name}
              onChange={(e) => updateMedication(idx, "name", e.target.value)}
              style={{ flex: 2 }}
            />
            <select
              className="form-select"
              value={med.response}
              onChange={(e) => updateMedication(idx, "response", e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">Response</option>
              <option value="full">Full</option>
              <option value="partial">Partial</option>
              <option value="none">None</option>
            </select>
            {medications.length > 1 && (
              <button type="button" onClick={() => removeMedication(idx)} aria-label="Remove medication" style={removeBtnStyle}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addMedication} style={addBtnStyle}>
          + Add medication
        </button>
      </FormSection>

      {/* Procedures */}
      <FormSection title="Procedures" hint="Optional.">
        {procedures.map((proc, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input
              className="form-input"
              placeholder="e.g. Chest X-ray"
              value={proc}
              onChange={(e) => updateProcedure(idx, e.target.value)}
              style={{ flex: 1 }}
            />
            {procedures.length > 1 && (
              <button type="button" onClick={() => removeProcedure(idx)} aria-label="Remove procedure" style={removeBtnStyle}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addProcedure} style={addBtnStyle}>
          + Add procedure
        </button>
      </FormSection>

      {/* Clinical notes + outcome */}
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

      <button type="submit" className="btn-submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit case"}
      </button>
    </form>
  );
}

function FormSection({ title, hint, children }) {
  return (
    <div
      style={{
        background: "var(--white)",
        border: "1.5px solid var(--lavender-100)",
        borderRadius: 14,
        padding: 22,
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14.5, fontWeight: 700, color: "var(--navy)" }}>
          {title}
        </div>
        {hint && <div className="field-hint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

const removeBtnStyle = {
  flexShrink: 0,
  width: 38,
  border: "1.5px solid var(--lavender-100)",
  background: "var(--white)",
  color: "var(--text-muted)",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
};

const addBtnStyle = {
  background: "none",
  border: "1.5px dashed var(--lavender-200)",
  color: "var(--lavender-600)",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
