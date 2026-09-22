import GrantGuardPanel from "./components/GrantGuardPanel.jsx";

export default function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>GrantGuard</h1>
      <p style={{ color: "#555", marginTop: "-0.5rem" }}>
        Trust-minimized milestone verification, powered by GenLayer.
      </p>
      <GrantGuardPanel />
    </div>
  );
}
