/* eslint-disable react/prop-types */
import { useState, useCallback, useEffect } from "react";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x8Fc59D3a4dB29418eEb181964Ac62f39Bdb21247";
const EXPLORER = "https://explorer-bradbury.genlayer.com";
const readClient = createClient({ chain: testnetBradbury });

const READ_METHODS = [
  { name: "get_campaign_info", params: [] },
  { name: "get_submission", params: [{ n: "submission_id", t: "int" }] },
  { name: "get_submissions_by_submitter", params: [{ n: "submitter", t: "str" }] },
];
const WRITE_METHODS = [
  { name: "claim_reward", params: [{ n: "submission_id", t: "int" }] },
  { name: "create_campaign", params: [{ n: "title", t: "str" }, { n: "spec", t: "str" }] },
  { name: "fund_campaign", params: [{ n: "reward_per_milestone", t: "gen" }], payable: true },
  { name: "submit_milestone", params: [{ n: "evidence_url", t: "str" }, { n: "description", t: "str" }] },
  { name: "verify_submission", params: [{ n: "submission_id", t: "int" }] },
];

function toWei(v) {
  const s = String(v).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`"${v}" is not a valid GEN amount`);
  const [w, f = ""] = s.split(".");
  return BigInt(w + f.padEnd(18, "0").slice(0, 18));
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
function plain(x) {
  if (typeof x === "bigint") return x.toString();
  if (x instanceof Map) return Object.fromEntries([...x].map(([k, v]) => [k, plain(v)]));
  if (Array.isArray(x)) return x.map(plain);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, plain(v)]));
  return x;
}
const pretty = (x) => (typeof x === "string" ? x : JSON.stringify(plain(x), null, 2));
function execFailed(r) {
  const name = String(r?.txExecutionResultName ?? r?.consensus_data?.leader_receipt?.[0]?.execution_result ?? "").toUpperCase();
  return name.includes("ERROR");
}
const gen = (v) => Number((Number(v) / 1e18).toFixed(4));

function Section({ title, startOpen = true, children }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="gg-card gg-box">
      <button className="gg-sec-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {title}<span className="gg-chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && children}
    </div>
  );
}

function MethodRow({ m, kind, account, onWrite }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState({});
  const [amount, setAmount] = useState("");
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
        setOut(pretty(await readClient.readContract({ address: CONTRACT_ADDRESS, functionName: m.name, args })));
      } else {
        setOut(await onWrite(m.name, args, m.payable ? toWei(amount) : 0n));
      }
    } catch (e) {
      setOut("Error: " + (e?.message ?? e));
    }
    setBusy(false);
  }

  return (
    <div>
      <button className="gg-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {m.name}{m.payable && <span className="gg-tag">payable</span>}
        <span className="gg-chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="gg-body">
          {m.params.map((p) => (
            <input key={p.n} className="gg-input"
              placeholder={p.n === "submitter" && account ? "submitter (empty = my wallet)" : p.t === "gen" ? `${p.n} (GEN)` : p.n}
              value={vals[p.n] ?? ""} onChange={(e) => setVals({ ...vals, [p.n]: e.target.value })} />
          ))}
          {m.payable && <input className="gg-input" placeholder="amount to send (GEN)" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          {kind === "write" && !account && <div className="gg-note">Connect your wallet (top right) to send this.</div>}
          <button className="gg-btn sm" onClick={run} disabled={busy || (kind === "write" && !account)}>
            {busy ? "Waiting…" : kind === "read" ? "Call" : "Send"}
          </button>
          {out && <pre className="gg-out">{out}</pre>}
        </div>
      )}
    </div>
  );
}

function MethodsSection({ account, onChanged }) {
  const [txs, setTxs] = useState([]);
  const onWrite = useCallback(async (functionName, args, value) => {
    const { client } = account;
    const hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName, args, value });
    setTxs((p) => [{ hash, method: functionName, time: new Date().toLocaleTimeString(), status: "pending" }, ...p]);
    const mark = (status) => setTxs((p) => p.map((t) => (t.hash === hash ? { ...t, status } : t)));
    try {
      const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 40, interval: 4000 });
      if (execFailed(receipt)) { mark("failed"); return `Failed: execution error\n${hash}`; }
      mark("accepted");
      onChanged();
      return `Accepted\n${hash}`;
    } catch (e) { mark("failed"); throw e; }
  }, [account, onChanged]);

  const color = { accepted: "#15803d", failed: "#b91c1c", pending: "#92400e" };
  return (
    <>
      <h2 style={{ fontSize: 18, margin: "26px 0 12px" }}>Contract methods</h2>
      <Section title="Read methods">
        {READ_METHODS.map((m) => <MethodRow key={m.name} m={m} kind="read" account={account} onWrite={onWrite} />)}
      </Section>
      <Section title="Write methods">
        {WRITE_METHODS.map((m) => <MethodRow key={m.name} m={m} kind="write" account={account} onWrite={onWrite} />)}
      </Section>
      <Section title={`Transactions (${txs.length})`} startOpen={false}>
        {txs.length === 0 && <div style={{ padding: "12px 18px", fontSize: 14, color: "#64748b" }}>No transactions yet.</div>}
        {txs.map((t) => (
          <div key={t.hash} style={{ padding: "12px 18px", borderTop: "1px solid #eef2f7", fontSize: 13 }}>
            <strong>{t.method}</strong> <span style={{ color: color[t.status], fontWeight: 700 }}>{t.status}</span>
            <span style={{ color: "#94a3b8" }}> · {t.time}</span>
            <div style={{ wordBreak: "break-all", marginTop: 4 }}>
              <a href={`${EXPLORER}/tx/${t.hash}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{t.hash}</a>
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}

export default function GrantGuardPanel({ account }) {
  const [campaign, setCampaign] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submissionId, setSubmissionId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  const loadCampaign = useCallback(async () => {
    setCampaign(await readClient.readContract({ address: CONTRACT_ADDRESS, functionName: "get_campaign_info", args: [] }));
  }, []);
  const refreshSubmissions = useCallback(async (address) => {
    setSubmissions(await readClient.readContract({ address: CONTRACT_ADDRESS, functionName: "get_submissions_by_submitter", args: [address] }));
  }, []);
  const refreshAll = useCallback(async () => {
    try { await loadCampaign(); if (account) await refreshSubmissions(account.address); }
    catch (e) { setError(e.message ?? String(e)); }
  }, [account, loadCampaign, refreshSubmissions]);

  useEffect(() => { loadCampaign().catch((e) => setError(e.message ?? String(e))); }, [loadCampaign]);
  useEffect(() => {
    if (account) refreshSubmissions(account.address).catch((e) => setError(e.message ?? String(e)));
    else setSubmissions([]);
  }, [account, refreshSubmissions]);

  const wait = (client, hash, retries, interval) =>
    client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries, interval });

  const handleSubmit = useCallback(async () => {
    if (!account) return;
    const { client } = account;
    setStatus("submitting"); setError(null); setResult(null);
    try {
      const h1 = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: "submit_milestone", args: [evidenceUrl, description], value: 0n });
      await wait(client, h1, 30, 3000);
      const info = await client.readContract({ address: CONTRACT_ADDRESS, functionName: "get_campaign_info", args: [] });
      const newId = info.submission_count;
      setSubmissionId(newId); setCampaign(info); setStatus("pending_consensus");
      const h2 = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: "verify_submission", args: [newId], value: 0n });
      await wait(client, h2, 40, 4000);
      setResult(await client.readContract({ address: CONTRACT_ADDRESS, functionName: "get_submission", args: [newId] }));
      setStatus("done");
      await refreshSubmissions(account.address);
    } catch (e) { setError(e.message ?? String(e)); setStatus("error"); }
  }, [account, evidenceUrl, description, refreshSubmissions]);

  const handleClaim = useCallback(async (id) => {
    if (!account) return;
    const { client } = account;
    setClaimingId(id); setError(null);
    try {
      const h = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: "claim_reward", args: [id], value: 0n });
      await wait(client, h, 30, 3000);
      await loadCampaign();
      await refreshSubmissions(account.address);
    } catch (e) { setError(e.message ?? String(e)); setStatus("error"); }
    finally { setClaimingId(null); }
  }, [account, loadCampaign, refreshSubmissions]);

  const busy = status === "submitting" || status === "pending_consensus";

  return (
    <div>
      {campaign && (
        <div className="gg-card">
          <div className="gg-pill verified" style={{ marginBottom: 8 }}>LIVE CAMPAIGN</div>
          <h2 style={{ marginBottom: 6 }}>{campaign.title}</h2>
          <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>{campaign.spec}</div>
          <div className="gg-stats">
            <div className="gg-stat"><b>{gen(campaign.pool_balance)} GEN</b><small>Pool balance</small></div>
            <div className="gg-stat"><b>{gen(campaign.reward_per_milestone)} GEN</b><small>Reward per milestone</small></div>
            <div className="gg-stat"><b>{String(campaign.submission_count)}</b><small>Submissions</small></div>
          </div>
        </div>
      )}

      <div className="gg-card">
        <h2>Submit milestone evidence</h2>
        {!account && <div className="gg-note">Connect your wallet (top right) to submit evidence.</div>}
        <label className="gg-label">Evidence URL</label>
        <input className="gg-input" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://your-deployed-app.com" />
        <label className="gg-label">Description</label>
        <textarea className="gg-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this evidence demonstrate?" />
        <button className="gg-btn" onClick={handleSubmit} disabled={!account || busy || !evidenceUrl.trim()}>
          {busy ? "Working…" : "Submit for verification"}
        </button>
        {status === "submitting" && <div className="gg-info"><span className="gg-spin" />Sending your evidence onchain…</div>}
        {status === "pending_consensus" && <div className="gg-info"><span className="gg-spin" />Submission #{String(submissionId)}: validators are reaching consensus. This can take a few minutes.</div>}
        {status === "done" && result && (
          <div className="gg-info" style={{ display: "block" }}>
            <span className={`gg-pill ${result.status}`}>{String(result.status).toUpperCase()}</span>{" "}
            <small>confidence: {result.confidence}</small>
            <div style={{ marginTop: 6 }}>{result.reasoning}</div>
          </div>
        )}
        {error && <div className="gg-err">{error}</div>}
      </div>

      {account && submissions.length > 0 && (
        <div className="gg-card">
          <h2>Your submissions</h2>
          {submissions.map((s) => (
            <div key={String(s.id)} className="gg-sub-item">
              <strong>#{String(s.id)}</strong>{" "}
              <span className={`gg-pill ${s.status}`}>{String(s.status).toUpperCase()}</span>
              {s.paid && <span className="gg-pill verified" style={{ marginLeft: 6 }}>PAID</span>}
              <div className="gg-url">{s.evidence_url}</div>
              {s.status === "verified" && !s.paid && (
                <button className="gg-btn sm" onClick={() => handleClaim(s.id)} disabled={claimingId === s.id}>
                  {claimingId === s.id ? "Claiming…" : "Claim reward"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <MethodsSection account={account} onChanged={refreshAll} />
    </div>
  );
}
