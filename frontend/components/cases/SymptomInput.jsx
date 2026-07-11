"use client";

/**
 * Repeatable list editor for symptoms: [{ name, onset_day }]
 */
export default function SymptomInput({ value = [], onChange }) {
  const update = (idx, field, val) => {
    onChange(value.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  };

  const add = () => onChange([...value, { name: "", onset_day: "" }]);
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div>
      {value.map((item, idx) => (
        <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input
            className="form-input"
            placeholder="Symptom (e.g. fever, rash)"
            value={item.name}
            onChange={(e) => update(idx, "name", e.target.value)}
            style={{ flex: 2 }}
          />
          <input
            className="form-input"
            type="number"
            min="0"
            placeholder="Onset day"
            value={item.onset_day}
            onChange={(e) => update(idx, "onset_day", e.target.value)}
            style={{ flex: 1 }}
          />
          {value.length > 1 && (
            <button
              type="button"
              onClick={() => remove(idx)}
              aria-label="Remove symptom"
              style={removeBtnStyle}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={add} style={addBtnStyle}>
        + Add symptom
      </button>
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
