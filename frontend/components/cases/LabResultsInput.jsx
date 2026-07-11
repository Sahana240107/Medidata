"use client";

/**
 * Repeatable list editor for lab results: [{ marker, value, flag }]
 */
export default function LabResultsInput({ value = [], onChange }) {
  const update = (idx, field, val) => {
    onChange(value.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  };

  const add = () => onChange([...value, { marker: "", value: "", flag: "" }]);
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div>
      {value.map((item, idx) => (
        <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input
            className="form-input"
            placeholder="Marker (e.g. CRP, WBC)"
            value={item.marker}
            onChange={(e) => update(idx, "marker", e.target.value)}
            style={{ flex: 2 }}
          />
          <input
            className="form-input"
            placeholder="Value"
            value={item.value}
            onChange={(e) => update(idx, "value", e.target.value)}
            style={{ flex: 1 }}
          />
          <select
            className="form-select"
            value={item.flag}
            onChange={(e) => update(idx, "flag", e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Flag</option>
            <option value="elevated">Elevated</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
          </select>
          {value.length > 1 && (
            <button
              type="button"
              onClick={() => remove(idx)}
              aria-label="Remove lab result"
              style={removeBtnStyle}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={add} style={addBtnStyle}>
        + Add lab result
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
