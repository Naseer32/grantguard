/* eslint-disable react/prop-types */
export function Pill({ kind, children }) {
  return <span className={`gg-pill ${kind || ""}`}>{children}</span>;
}

export function Spin({ children }) {
  return (
    <div className="gg-info">
      <span className="gg-spin" />
      <span>{children}</span>
    </div>
  );
}

export function Err({ children }) {
  return children ? <div className="gg-err">{children}</div> : null;
}

export function Note({ children }) {
  return <div className="gg-note">{children}</div>;
}

export function Field({ label, hint, children }) {
  return (
    <div>
      <label className="gg-label">{label}</label>
      {children}
      {hint && <div className="gg-hint">{hint}</div>}
    </div>
  );
}
