import GrantGuardPanel from "./components/GrantGuardPanel.jsx";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #eefcf4 0%, #f8fafc 38%, #ffffff 100%)",
        color: "#111827",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.04em",
              }}
            >
              Grant<span style={{ color: "#16a34a" }}>Guard</span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 3,
              }}
            >
              Trust-minimized grant infrastructure
            </div>
          </div>

          <div
            style={{
              padding: "7px 11px",
              borderRadius: 999,
              background: "#ecfdf3",
              color: "#15803d",
              border: "1px solid #bbf7d0",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            GenLayer Powered
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "38px 20px 60px",
        }}
      >
        <section
          style={{
            maxWidth: 760,
            margin: "0 auto 30px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 10px",
              borderRadius: 999,
              background: "#111827",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            ● ONCHAIN MILESTONE VERIFICATION
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px, 7vw, 58px)",
              lineHeight: 1.02,
              letterSpacing: "-0.055em",
              fontWeight: 850,
            }}
          >
            Fund work.
            <br />
            <span style={{ color: "#16a34a" }}>Verify results.</span>
            <br />
            Release fairly.
          </h1>

          <p
            style={{
              maxWidth: 650,
              color: "#6b7280",
              fontSize: 16,
              lineHeight: 1.7,
              margin: "18px 0 0",
            }}
          >
            GrantGuard uses GenLayer to verify milestone evidence while
            keeping grant funding and settlement deterministic onchain.
          </p>
        </section>

        <GrantGuardPanel />
      </main>

      <footer
        style={{
          borderTop: "1px solid #e5e7eb",
          background: "#fff",
          padding: "20px",
          textAlign: "center",
          color: "#9ca3af",
          fontSize: 12,
        }}
      >
        GrantGuard · GenLayer Studio
      </footer>
    </div>
  );
}
