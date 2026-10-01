/* eslint-disable react/prop-types */
import { useState, useCallback, useEffect } from "react";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { CampaignList, CreateCampaign, Mine } from "./components/Campaigns.jsx";
import CampaignView from "./components/CampaignView.jsx";
import Methods from "./components/Methods.jsx";
import { CONTRACT_ADDRESS, EXPLORER, short, errText } from "./lib.js";

const CHAIN_HEX = "0x107d";
const CHAIN_PARAMS = {
  chainId: CHAIN_HEX,
  chainName: "GenLayer Bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  blockExplorerUrls: [EXPLORER],
};

async function ensureBradbury() {
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS] });
    } else {
      throw e;
    }
  }
}

const TABS = [
  ["campaigns", "Campaigns"],
  ["create", "Create"],
  ["mine", "My activity"],
  ["contract", "Contract"],
];

const css = `
*{box-sizing:border-box}
body{margin:0}
.gg-app{min-height:100vh;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;
  background:radial-gradient(circle at top left,#dcfce7 0%,#f8fafc 40%,#fff 100%)}
.gg-header{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.88);backdrop-filter:blur(14px);border-bottom:1px solid #e5e7eb}
.gg-header-in{max-width:900px;margin:0 auto;padding:12px 18px 6px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.gg-logo{font-size:21px;font-weight:800;letter-spacing:-.04em;cursor:pointer}
.gg-logo span{color:#16a34a}
.gg-sub{font-size:11px;color:#6b7280;margin-top:2px}
.gg-wallet{border:0;border-radius:999px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer;
  background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.35);transition:.15s}
.gg-wallet:disabled{opacity:.6;cursor:default}
.gg-wallet.on{background:#ecfdf3;color:#15803d;border:1px solid #bbf7d0;box-shadow:none;display:flex;align-items:center;gap:8px}
.gg-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px #bbf7d0}
.gg-nav{max-width:900px;margin:0 auto;padding:0 12px;display:flex;gap:4px;overflow-x:auto}
.gg-tab{border:0;background:none;padding:10px 12px;font:inherit;font-size:14px;font-weight:600;color:#64748b;cursor:pointer;
  border-bottom:2px solid transparent;white-space:nowrap}
.gg-tab.on{color:#15803d;border-bottom-color:#16a34a}
.gg-banner{max-width:900px;margin:10px auto 0;padding:10px 14px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px}
.gg-main{max-width:760px;margin:0 auto;padding:24px 18px 56px}
.gg-badge{display:inline-block;padding:6px 11px;border-radius:999px;background:#0f172a;color:#fff;font-size:11px;font-weight:700;margin-bottom:14px}
.gg-h1{margin:0;font-size:clamp(30px,7vw,50px);line-height:1.03;letter-spacing:-.05em;font-weight:850}
.gg-h1 span{color:#16a34a}
.gg-lead{color:#64748b;font-size:16px;line-height:1.7;margin:14px 0 22px;max-width:600px}
.gg-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.gg-step{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px}
.gg-step b{display:block;font-size:14px;margin-bottom:4px}
.gg-step small{color:#64748b;font-size:12px;line-height:1.4}
.gg-card{display:block;width:100%;text-align:left;font:inherit;color:inherit;background:#fff;border:1px solid #e5e7eb;border-radius:16px;
  padding:18px;margin-bottom:14px;box-shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px rgba(15,23,42,.05)}
.gg-card h2{margin:0 0 12px;font-size:17px;letter-spacing:-.02em}
.gg-click{cursor:pointer;transition:.15s}
.gg-click:hover{transform:translateY(-2px);border-color:#bbf7d0}
.gg-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.gg-spec{color:#475569;font-size:14px;line-height:1.55;margin:8px 0}
.gg-meta{color:#64748b;font-size:12.5px}
.gg-hint{color:#94a3b8;font-size:12px;margin-top:5px}
.gg-check{font-size:13px;color:#475569;display:flex;gap:6px;align-items:center}
.gg-back{border:0;background:none;color:#15803d;font:inherit;font-weight:700;cursor:pointer;padding:0 0 12px}
.gg-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.gg-stat{background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:12px}
.gg-stat b{display:block;font-size:18px;letter-spacing:-.03em}
.gg-stat small{color:#64748b;font-size:11px}
.gg-label{display:block;font-size:12px;font-weight:700;color:#475569;margin:12px 0 6px}
.gg-input{width:100%;padding:12px;border:1px solid #d1d5db;border-radius:10px;font:inherit;font-size:15px;background:#fff}
.gg-input:focus{outline:none;border-color:#16a34a;box-shadow:0 0 0 3px #bbf7d0}
textarea.gg-input{min-height:84px;resize:vertical}
.gg-btn{margin-top:14px;width:100%;border:0;border-radius:10px;padding:13px;font-size:15px;font-weight:700;color:#fff;cursor:pointer;
  background:linear-gradient(135deg,#16a34a,#15803d)}
.gg-btn:disabled{opacity:.5;cursor:not-allowed}
.gg-btn.sm{width:auto;margin:10px 8px 0 0;padding:9px 15px;font-size:13.5px}
.gg-btn.ghost{background:#fff;color:#b91c1c;border:1px solid #fecaca}
.gg-note{margin:0 0 14px;padding:11px 13px;border-radius:10px;background:#fefce8;color:#854d0e;font-size:13px}
.gg-info{margin:0 0 14px;padding:12px 14px;border-radius:10px;background:#f0fdf4;color:#166534;font-size:14px;display:flex;gap:10px;align-items:center}
.gg-err{margin:0 0 14px;padding:11px 13px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px;word-break:break-word}
.gg-spin{width:16px;height:16px;border:2px solid #86efac;border-top-color:#16a34a;border-radius:50%;animation:gg .8s linear infinite;flex:none}
@keyframes gg{to{transform:rotate(360deg)}}
.gg-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.03em;background:#f1f5f9;color:#475569}
.gg-pill.verified{background:#dcfce7;color:#15803d}
.gg-pill.rejected{background:#fee2e2;color:#b91c1c}
.gg-sub-item{padding:14px 0;border-top:1px solid #eef2f7}
.gg-sub-item:first-of-type{border-top:0}
.gg-url{display:block;font-size:12.5px;color:#2563eb;word-break:break-all;margin-top:6px}
.gg-desc{font-size:13.5px;color:#334155;margin-top:6px}
.gg-reason{font-size:12.5px;color:#64748b;margin-top:6px;font-style:italic}
.gg-box{padding:0;overflow:hidden}
.gg-sec-head,.gg-head{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;cursor:pointer}
.gg-sec-head{padding:14px 18px;font-weight:700;font-size:15px;background:#f8fafc}
.gg-head{padding:13px 18px;border-top:1px solid #eef2f7;font-family:ui-monospace,monospace;font-size:13.5px}
.gg-chev{margin-left:auto;color:#94a3b8}
.gg-tag{font-family:sans-serif;font-size:10px;padding:2px 8px;border-radius:99px;background:#fef3c7;color:#92400e}
.gg-body{display:flex;flex-direction:column;gap:8px;padding:2px 18px 16px}
.gg-out{margin:0;padding:10px;border-radius:10px;background:#0f172a;color:#e2e8f0;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:260px;overflow:auto}
@media(max-width:560px){.gg-steps{grid-template-columns:1fr 1fr}.gg-sub{display:none}.gg-stats{grid-template-columns:1fr 1fr}}
`;

export default function App() {
  const [account, setAccount] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [view, setView] = useState({ page: "campaigns", id: null });

  const connect = useCallback(async () => {
    setConnecting(true);
    setWalletError("");
    try {
      if (!window.ethereum) {
        throw new Error("No wallet found. Open this page in the MetaMask browser or install a wallet.");
      }
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBradbury();
      const client = createClient({ chain: testnetBradbury, account: address, provider: window.ethereum });
      await client.initializeConsensusSmartContract();
      setAccount({ address, client });
    } catch (e) {
      setWalletError(errText(e));
    }
    setConnecting(false);
  }, []);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return undefined;
    const reset = () => setAccount(null);
    eth.on("accountsChanged", reset);
    return () => eth.removeListener?.("accountsChanged", reset);
  }, []);

  const go = (page, id = null) => {
    setView({ page, id });
    window.scrollTo({ top: 0 });
  };
  const openCampaign = (id) => go("campaign", id);
  const tab = view.page === "campaign" ? "campaigns" : view.page;

  return (
    <div className="gg-app">
      <style>{css}</style>
      <header className="gg-header">
        <div className="gg-header-in">
          <div onClick={() => go("campaigns")}>
            <div className="gg-logo">Grant<span>Guard</span></div>
            <div className="gg-sub">Open grants, verified by GenLayer</div>
          </div>
          {account ? (
            <div className="gg-wallet on"><span className="gg-dot" />{short(account.address)}</div>
          ) : (
            <button className="gg-wallet" onClick={connect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
        </div>
        <nav className="gg-nav">
          {TABS.map(([key, label]) => (
            <button key={key} className={`gg-tab ${tab === key ? "on" : ""}`} onClick={() => go(key)}>
              {label}
            </button>
          ))}
        </nav>
        {walletError && <div className="gg-banner">{walletError}</div>}
      </header>

      <main className="gg-main">
        {view.page === "campaigns" && (
          <>
            <div className="gg-badge">● ONCHAIN MILESTONE VERIFICATION</div>
            <h1 className="gg-h1">Fund work.<br /><span>Verify results.</span><br />Release fairly.</h1>
            <p className="gg-lead">
              Anyone can open a grant campaign, and anyone can earn from it. GenLayer validators
              check the evidence, and rewards are paid by the contract.
            </p>
            <CampaignList onOpen={openCampaign} onCreate={() => go("create")} />
          </>
        )}
        {view.page === "campaign" && (
          <CampaignView key={view.id} id={view.id} account={account} onBack={() => go("campaigns")} />
        )}
        {view.page === "create" && <CreateCampaign account={account} onCreated={openCampaign} />}
        {view.page === "mine" && <Mine account={account} onOpen={openCampaign} />}
        {view.page === "contract" && <Methods account={account} />}
      </main>

      <footer style={{ borderTop: "1px solid #e5e7eb", background: "#fff", padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
        GrantGuard · GenLayer Bradbury ·{" "}
        <a href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" style={{ color: "#64748b" }}>
          {short(CONTRACT_ADDRESS)}
        </a>
      </footer>
    </div>
  );
}
