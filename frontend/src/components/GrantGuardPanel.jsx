/* eslint-disable react/prop-types */
// GrantGuardPanel.jsx
//
// Real genlayer-js wiring against a deployed GrantGuard contract, on
// GenLayer Bradbury testnet. Shows the campaign spec, pool balance, and
// reward per milestone on load (read-only, no wallet needed), lets a
// connected wallet submit + verify evidence with a visible pending
// state, lists that wallet's past submissions and their verdicts, and
// lets a verified submitter claim their GEN reward.
//
// Also has a Studio-style "Contract methods" section: every read/write
// method as a collapsible row (tap to open, tap again to close), plus a
// Transactions list.
//
// Requires: npm install genlayer-js
// Requires a browser wallet (MetaMask or compatible) for signing.

import { useState, useCallback, useEffect } from "react";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x8Fc59D3a4dB29418eEb181964Ac62f39Bdb21247";
const EXPLORER = "https://explorer-bradbury.genlayer.com";

const BRADBURY_CHAIN_ID_HEX = "0x107d"; // 4221 decimal
const BRADBURY_PARAMS = {
  chainId: BRADBURY_CHAIN_ID_HEX,
  chainName: "GenLayer Bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  blockExplorerUrls: [EXPLORER],
};

async function ensureBradbury() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY_CHAIN_ID_HEX }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [BRADBURY_PARAMS],
      });
    } else {
      throw switchError;
    }
  }
}

const readClient = createClient({ chain: testnetBradbury });

// ---------------------------------------------------------------------------
// Methods shown in the collapsible section.
// t = "int" | "str" | "gen" (GEN amount, sent as wei)
// If a param name or type is wrong for your deployed contract, fix it here.
// ---------------------------------------------------------------------------
const READ_METHODS = [
  { name: "get_campaign_info", params: [] },
  { name: "get_submission", params: [{ n: "submission_id", t: "int" }] },
  { name: "get_submissions_by_submitter", params: [{ n: "submitter", t: "str" }] },
];

const WRITE_METHODS = [
  { name: "claim_reward", params: [{ n: "submission_id", t: "int" }] },
  {
    name: "create_campaign",
    params: [
      { n: "title", t: "str" },
      { n: "spec", t: "str" },
    ],
  },
  { name: "fund_campaign", params: [{ n: "reward_per_milestone", t: "gen" }], payable: true },
  {
    name: "submit_milestone",
    params: [
      { n: "evidence_url", t: "str" },
      { n: "description", t: "str" },
    ],
  },
  { name: "verify_submission", params: [{ n: "submission_id", t: "int" }] },
];

// "0.5" -> 500000000000000000n (no floating point)
function toWei(v) {
  const s = String(v).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`"${v}" is not a valid GEN amount`);
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole + frac.padEnd(18, "0").slice(0, 18));
}

function convertArg(p, raw) {
  const v = (raw ?? "").trim();
  if (p.t === "int") {
    if (!/^\d+$/.test(v)) throw new Error(`${p.n} must be a whole number`);
    return Number(v);
  }
  if (p.t === "gen") return toWei(v);
  return raw ?? "";
}

// genlayer-js can return Map / bigint; make it printable.
function plain(x) {
  if (typeof x === "bigint") return x.toString();
  if (x instanceof Map) return Object.fromEntries([...x].map(([k, v]) => [k, plain(v)]));
  if (Array.isArray(x)) return x.map(plain);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, plain(v)]));
  return x;
}
const pretty = (x) => (typeof x === "string" ? x : JSON.stringify(plain(x), null, 2));

const ui = {
  box: { border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff", marginBottom: 14 },
  secHead: {
    display: "flex", alignItems: "center", width: "100%", padding: "13px 14px", background: "#f8fafc",
    border: 0, fontSize: 15, fontWeight: 700, color: "#111827", cursor: "pointer", textAlign: "left",
  },
  rowHead: {
    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px", background: "#fff",
    border: 0, borderTop: "1px solid #eef0f3", fontSize: 14, fontWeight: 500, color: "#111827",
    cursor: "pointer", textAlign: "left", fontFamily: "ui-monospace, monospace",
  },
  chev: { marginLeft: "auto", color: "#9ca3af" },
  tag: { fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#fef3c7", color: "#92400e", fontFamily: "sans-serif" },
  body: { display: "flex", flexDirection: "column", gap: 8, padding: "4px 14px 14px" },
  input: { padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, width: "100%", boxSizing: "border-box" },
  run: { padding: 10, border: 0, borderRadius: 8, background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 15 },
  out: {
    margin: 0, padding: 10, borderRadius: 8, background: "#f3f4f6", fontSize: 12, whiteSpace: "pre-wrap",
    wordBreak: "break-all", maxHeight: 260, overflow: "auto",
  },
};

function execFailed(r) {
  const name = String(
    r?.txExecutionResultName ??
      r?.consensus_data?.leader_receipt?.[0]?.execution_result ??
      ""
  ).toUpperCase();
  return name.includes("ERROR");
}

function Section({ title, startOpen = true, children }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div style={ui.box}>
      <button style={ui.secHead} onClick={() => setOpen(!open)} aria-expanded={open}>
        {title}
        <span style={ui.chev}>{open ? "▾" : "▸"}</span>
      </button>
      {open && children}
    </div>
  );
}

function MethodRow({ m, kind, account, onWrite }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState({});
  const [gen, setGen] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setOut("");
    try {
      const args = m.params.map((p) => {
        let raw = vals[p.n];
        if (p.n === "submitter" && !raw && account) raw = account.address;
        return convertArg(p, raw);
      });
      if (kind === "read") {
        const res = await readClient.readContract({ address: CONTRACT_ADDRESS, functionName: m.name, args });
        setOut(pretty(res));
      } else {
        const value = m.payable ? toWei(gen) : 0n;
        setOut(await onWrite(m.name, args, value));
      }
    } catch (e) {
      setOut("Error: " + (e?.message ?? e));
    }
    setBusy(false);
  }

  return (
    <div>
      <button style={ui.rowHead} onClick={() => setOpen(!open)} aria-expanded={open}>
        {m.name}
        {m.payable && <span style={ui.tag}>payable</span>}
        <span style={ui.chev}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={ui.body}>
          {m.params.map((p) => (
            <input
              key={p.n}
              style={ui.input}
              placeholder={
                p.n === "submitter" && account ? "submitter (empty = my wallet)" : p.t === "gen" ? `${p.n} (GEN)` : p.n
              }
              value={vals[p.n] ?? ""}
              onChange={(e) => setVals({ ...vals, [p.n]: e.target.value })}
            />
          ))}
          {m.payable && (
            <input style={ui.input} placeholder="amount (GEN)" value={gen} onChange={(e) => setGen(e.target.value)} />
          )}
          {kind === "write" && !account && (
            <div style={{ fontSize: 13, color: "#b45309" }}>Connect your wallet first to send this.</div>
          )}
          <button style={{ ...ui.run, opacity: busy ? 0.6 : 1 }} onClick={run} disabled={busy || (kind === "write" && !account)}>
            {busy ? "Waiting…" : kind === "read" ? "Call" : "Send"}
          </button>
          {out && <pre style={ui.out}>{out}</pre>}
        </div>
      )}
    </div>
  );
}

function MethodsSection({ account, onChanged }) {
  const [txs, setTxs] = useState([]);

  const onWrite = useCallback(
    async (functionName, args, value) => {
      const { client } = account;
      const hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName, args, value });
      const time = new Date().toLocaleTimeString();
      setTxs((p) => [{ hash, method: functionName, time, status: "pending" }, ...p]);
      const mark = (status) => setTxs((p) => p.map((t) => (t.hash === hash ? { ...t, status } : t)));
      try {
        const receipt = await client.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.ACCEPTED,
          retries: 40,
          interval: 4000,
        });
        if (execFailed(receipt)) {
          mark("failed");
          return `Failed: execution error\n${hash}`;
        }
        mark("accepted");
        onChanged();
        return `Accepted\n${hash}`;
      } catch (e) {
        mark("failed");
        throw e;
      }
    },
    [account, onChanged]
  );

  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Contract methods</h2>

      <Section title="Read methods">
        {READ_METHODS.map((m) => (
          <MethodRow key={m.name} m={m} kind="read" account={account} onWrite={onWrite} />
        ))}
      </Section>

      <Section title="Write methods">
        {WRITE_METHODS.map((m) => (
          <MethodRow key={m.name} m={m} kind="write" account={account} onWrite={onWrite} />
        ))}
      </Section>

      <Section title={`Transactions (${txs.length})`} startOpen={false}>
        {txs.length === 0 && (
          <div style={{ padding: "12px 14px", fontSize: 14, color: "#6b7280" }}>
            No transactions yet. Send a write method and it will appear here.
          </div>
        )}
        {txs.map((t) => (
          <div key={t.hash} style={{ padding: "12px 14px", borderTop: "1px solid #eef0f3", fontSize: 13 }}>
            <strong>{t.method}</strong>{" "}
            <span style={{ color: t.status === "accepted" ? "#15803d" : t.status === "failed" ? "#b91c1c" : "#92400e" }}>
              {t.status}
            </span>
            <span style={{ color: "#9ca3af" }}> · {t.time}</span>
            <div style={{ wordBreak: "break-all", color: "#6b7280", marginTop: 4 }}>
              <a href={`${EXPLORER}/tx/${t.hash}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                {t.hash}
              </a>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

export default function GrantGuardPanel() {
  const [account, setAccount] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submissionId, setSubmissionId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  useEffect(() => {
    readClient
      .readContract({ address: CONTRACT_ADDRESS, functionName: "get_campaign_info", args: [] })
      .then(setCampaign)
      .catch((err) => setError(err.message ?? String(err)));
  }, []);

  const refreshSubmissions = useCallback(async (address) => {
    const list = await readClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_submissions_by_submitter",
      args: [address],
    });
    setSubmissions(list);
  }, []);

  // Called after any write from the methods section.
  const refreshAll = useCallback(async () => {
    try {
      setCampaign(
        await readClient.readContract({ address: CONTRACT_ADDRESS, functionName: "get_campaign_info", args: [] })
      );
      if (account) await refreshSubmissions(account.address);
    } catch (err) {
      setError(err.message ?? String(err));
    }
  }, [account, refreshSubmissions]);

  const connectWallet = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      if (!window.ethereum) {
        throw new Error("No browser wallet found — install MetaMask or a compatible wallet.");
      }
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBradbury();
      const client = createClient({ chain: testnetBradbury, account: address, provider: window.ethereum });
      await client.initializeConsensusSmartContract();
      setAccount({ address, client });
      setStatus("idle");
      await refreshSubmissions(address);
    } catch (err) {
      setError(err.message ?? String(err));
      setStatus("error");
    }
  }, [refreshSubmissions]);

  const handleSubmit = useCallback(async () => {
    if (!account) {
      setError("Connect your wallet first.");
      setStatus("error");
      return;
    }
    const { client, address } = account;
    setStatus("submitting");
    setError(null);
    try {
      const submitTxHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_milestone",
        args: [evidenceUrl, description],
        value: 0n,
      });
      await client.waitForTransactionReceipt({
        hash: submitTxHash,
        status: TransactionStatus.ACCEPTED,
        retries: 30,
        interval: 3000,
      });

      const campaignInfo = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_campaign_info",
        args: [],
      });
      const newId = campaignInfo.submission_count;
      setSubmissionId(newId);
      setCampaign(campaignInfo);
      setStatus("pending_consensus");

      const verifyTxHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "verify_submission",
        args: [newId],
        value: 0n,
      });
      await client.waitForTransactionReceipt({
        hash: verifyTxHash,
        status: TransactionStatus.ACCEPTED,
        retries: 40,
        interval: 4000,
      });

      const sub = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_submission",
        args: [newId],
      });
      setResult(sub);
      setStatus("done");
      await refreshSubmissions(address);
    } catch (err) {
      setError(err.message ?? String(err));
      setStatus("error");
    }
  }, [account, evidenceUrl, description, refreshSubmissions]);

  const handleClaim = useCallback(async (id) => {
    if (!account) return;
    const { client, address } = account;
    setClaimingId(id);
    setError(null);
    try {
      const claimTxHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "claim_reward",
        args: [id],
        value: 0n,
      });
      await client.waitForTransactionReceipt({
        hash: claimTxHash,
        status: TransactionStatus.ACCEPTED,
        retries: 30,
        interval: 3000,
      });

      const campaignInfo = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_campaign_info",
        args: [],
      });
      setCampaign(campaignInfo);
      await refreshSubmissions(address);
    } catch (err) {
      setError(err.message ?? String(err));
      setStatus("error");
    } finally {
      setClaimingId(null);
    }
  }, [account, refreshSubmissions]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", fontFamily: "sans-serif" }}>
      {campaign && (
        <div style={{ background: "#f4f4f4", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem" }}>
          <strong>{campaign.title}</strong>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.9em", color: "#444" }}>{campaign.spec}</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8em", color: "#888" }}>
            {campaign.submission_count} submission(s) so far · pool: {(Number(campaign.pool_balance) / 1e18).toFixed(4)} GEN
            {" "}· reward per milestone: {(Number(campaign.reward_per_milestone) / 1e18).toFixed(4)} GEN
          </p>
        </div>
      )}

      <h2>Submit Milestone Evidence</h2>

      {!account ? (
        <button onClick={connectWallet} disabled={status === "connecting"}>
          {status === "connecting" ? "Connecting…" : "Connect Wallet"}
        </button>
      ) : (
        <p style={{ fontSize: "0.85em", color: "#555" }}>Connected: {account.address}</p>
      )}

      <label>
        Evidence URL
        <input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://your-deployed-app.com" style={{ width: "100%" }} />
      </label>

      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this evidence demonstrate?" style={{ width: "100%" }} />
      </label>

      <button onClick={handleSubmit}
        disabled={!account || status === "submitting" || status === "pending_consensus"}>
        Submit for verification
      </button>

      {status === "pending_consensus" && (
        <p>Submission #{submissionId} — validators are reaching consensus…</p>
      )}

      {status === "done" && result && (
        <div>
          <h3>Result: {String(result.status).toUpperCase()}</h3>
          <p>Confidence: {result.confidence}</p>
          <p>Reasoning: {result.reasoning}</p>
        </div>
      )}

      {status === "error" && <p style={{ color: "red" }}>{error}</p>}

      {account && submissions.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Your Submissions</h3>
          <ul style={{ paddingLeft: "1.2rem" }}>
            {submissions.map((s) => (
              <li key={s.id} style={{ marginBottom: "0.5rem" }}>
                #{s.id} — <strong>{String(s.status).toUpperCase()}</strong>
                {s.confidence ? ` (${s.confidence} confidence)` : ""}
                <br />
                <span style={{ fontSize: "0.85em", color: "#666" }}>{s.evidence_url}</span>
                {s.status === "verified" && !s.paid && (
                  <>
                    <br />
                    <button onClick={() => handleClaim(s.id)} disabled={claimingId === s.id} style={{ marginTop: "0.25rem" }}>
                      {claimingId === s.id ? "Claiming…" : "Claim reward"}
                    </button>
                  </>
                )}
                {s.status === "verified" && s.paid && (
                  <>
                    <br />
                    <span style={{ fontSize: "0.8em", color: "#2a7" }}>Reward claimed</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <MethodsSection account={account} onChanged={refreshAll} />
    </div>
  );
}
