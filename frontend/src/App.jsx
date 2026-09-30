/* eslint-disable react/prop-types */
import { useState, useCallback } from "react";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import GrantGuardPanel from "./components/GrantGuardPanel.jsx";

const CHAIN_HEX = "0x107d";
const CHAIN_PARAMS = {
  chainId: CHAIN_HEX,
  chainName: "GenLayer Bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
};

async function ensureBradbury() {
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS] });
    } else throw e;
  }
}

const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

const css = `
*{box-sizing:border-box}
body{margin:0}
.gg-app{min-height:100vh;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;
  background:radial-gradient(circle at top left,#dcfce7 0%,#f8fafc 40%,#fff 100%)}
.gg-header{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.85);backdrop-filter:blur(14px);border-bottom:1px solid #e5e7eb}
.gg-header-in{max-width:980px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.gg-logo{font-size:21px;font-weight:800;letter-spacing:-.04em}
.gg-logo span{color:#16a34a}
.gg-sub{font-size:11px;color:#6b7280;margin-top:2px}
.gg-wallet{border:0;border-radius:999px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer;
  background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.35);transition:.15s}
.gg-wallet:hover{transform:translateY(-1px)}
.gg-wallet:disabled{opacity:.6;cursor:default}
.gg-wallet.on{background:#ecfdf3;color:#15803d;border:1px solid #bbf7d0;box-shadow:none;display:flex;align-items:center;gap:8px}
.gg-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px #bbf7d0}
.gg-banner{max-width:980px;margin:10px auto 0;padding:10px 14px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px}
.gg-main{max-width:820px;margin:0 auto;padding:28px 18px 56px}
.gg-badge{display:inline-block;padding:6px 11px;border-radius:999px;background:#0f172a;color:#fff;font-size:11px;font-weight:700;margin-bottom:14px}
.gg-h1{margin:0;font-size:clamp(32px,7vw,54px);line-height:1.03;letter-spacing:-.05em;font-weight:850}
.gg-h1 span{color:#16a34a}
.gg-lead{color:#64748b;font-size:16px;line-height:1.7;margin:16px 0 28px;max-width:600px}
.gg-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:18px;margin-bottom:16px;box-shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px rgba(15,23,42,.05)}
.gg-card h2{margin:0 0 12px;font-size:17px;letter-spacing:-.02em}
.gg-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.gg-stat{background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:12px}
.gg-stat b{display:block;font-size:20px;letter-spacing:-.03em}
.gg-stat small{color:#64748b;font-size:11px}
.gg-label{display:block;font-size:12px;font-weight:700;color:#475569;margin:12px 0 6px}
.gg-input{width:100%;padding:12px;border:1px solid #d1d5db;border-radius:10px;font:inherit;font-size:15px;background:#fff;transition:.15s}
.gg-input:focus{outline:none;border-color:#16a34a;box-shadow:0 0 0 3px #bbf7d0}
textarea.gg-input{min-height:84px;resize:vertical}
.gg-btn{margin-top:14px;width:100%;border:0;border-radius:10px;padding:13px;font-size:15px;font-weight:700;color:#fff;cursor:pointer;
  background:linear-gradient(135deg,#16a34a,#15803d);transition:.15s}
.gg-btn:hover:not(:disabled){filter:brightness(1.06)}
.gg-btn:disabled{opacity:.5;cursor:not-allowed}
.gg-btn.sm{width:auto;margin:8px 0 0;padding:8px 14px;font-size:13px}
.gg-note{margin-top:12px;padding:11px 13px;border-radius:10px;background:#fefce8;color:#854d0e;font-size:13px}
.gg-info{margin-top:12px;padding:12px 14px;border-radius:10px;background:#f0fdf4;color:#166534;font-size:14px;display:flex;gap:10px;align-items:center}
.gg-err{margin-top:12px;padding:11px 13px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px;word-break:break-word}
.gg-spin{width:16px;height:16px;border:2px solid #86efac;border-top-color:#16a34a;border-radius:50%;animation:gg 0.8s linear infinite;flex:none}
@keyframes gg{to{transform:rotate(360deg)}}
.gg-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.03em;background:#f1f5f9;color:#475569}
.gg-pill.verified{background:#dcfce7;color:#15803d}
.gg-pill.rejected{background:#fee2e2;color:#b91c1c}
.gg-sub-item{padding:14px 0;border-top:1px solid #eef2f7}
.gg-sub-item:first-of-type{border-top:0}
.gg-url{font-size:12px;color:#64748b;word-break:break-all;margin-top:4px}
.gg-sec-head,.gg-head{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;cursor:pointer}
.gg-sec-head{padding:14px 18px;font-weight:700;font-size:15px;background:#f8fafc}
.gg-head{padding:13px 18px;border-top:1px solid #eef2f7;font-family:ui-monospace,monospace;font-size:13.5px}
.gg-head:hover{background:#f8fafc}
.gg-chev{margin-left:auto;color:#94a3b8}
.gg-tag{font-family:sans-serif;font-size:10px;padding:2px 8px;border-radius:99px;background:#fef3c7;color:#92400e}
.gg-body{display:flex;flex-direction:column;gap:8px;padding:2px 18px 16px}
.gg-out{margin:0;padding:10px;border-radius:10px;background:#0f172a;color:#e2e8f0;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:260px;overflow:auto}
.gg-box{padding:0;overflow:hidden}
@media(max-width:520px){.gg-stats{grid-template-columns:1fr 1fr}.gg-sub{display:none}}
`;

export default function App() {
  const [account, setAccount] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      if (!window.ethereum) throw new Error("No browser wallet found. Open this page in the MetaMask browser or install a wallet.");
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBradbury();
      const client = createClient({ chain: testnetBradbury, account: address, provider: window.ethereum });
      await client.initializeConsensusSmartContract();
      setAccount({ address, client });
    } catch (e) {
      setWalletError(e.message ?? String(e));
    }
    setConnecting(false);
  }, []);

  return (
    <div className="gg-app">
      <style>{css}</style>
      <header className="gg-header">
        <div className="gg-header-in">
          <div>
            <div className="gg-logo">Grant<span>Guard</span></div>
            <div className="gg-sub">Trust-minimized grant infrastructure</div>
          </div>
          {account ? (
            <div className="gg-wallet on"><span className="gg-dot" />{short(account.address)}</div>
          ) : (
            <button className="gg-wallet" onClick={connect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
        </div>
        {walletError && <div className="gg-banner">{walletError}</div>}
      </header>

      <main className="gg-main">
        <div className="gg-badge">● ONCHAIN MILESTONE VERIFICATION</div>
        <h1 className="gg-h1">Fund work.<br /><span>Verify results.</span><br />Release fairly.</h1>
        <p className="gg-lead">
          GrantGuard uses GenLayer validators to verify milestone evidence, while funding and
          reward settlement stay deterministic onchain.
        </p>
        <GrantGuardPanel account={account} />
      </main>

      <footer style={{ borderTop: "1px solid #e5e7eb", background: "#fff", padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
        GrantGuard · GenLayer Bradbury
      </footer>
    </div>
  );
}
