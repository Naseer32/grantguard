/* eslint-disable react/prop-types */
import { useState } from "react";
import { TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS, EXPLORER, readClient, plain, toWei, execFailed, errText } from "../lib.js";

const READ_METHODS = [
  { name: "get_campaign_count", params: [] },
  { name: "get_campaign", params: [{ n: "campaign_id", t: "int" }] },
  { name: "get_campaigns", params: [] },
  { name: "get_campaigns_by_creator", params: [{ n: "creator", t: "str" }] },
  { name: "get_campaign_submissions", params: [{ n: "campaign_id", t: "int" }] },
  { name: "get_submission", params: [{ n: "submission_id", t: "int" }] },
  { name: "get_submissions_by_submitter", params: [{ n: "submitter", t: "str" }] },
];

const WRITE_METHODS = [
  {
    name: "create_campaign",
    params: [{ n: "title", t: "str" }, { n: "spec", t: "str" }, { n: "reward_per_milestone", t: "gen" }],
    payable: true,
  },
  { name: "fund_campaign", params: [{ n: "campaign_id", t: "int" }], payable: true },
  {
    name: "submit_milestone",
    params: [{ n: "campaign_id", t: "int" }, { n: "evidence_url", t: "str" }, { n: "description", t: "str" }],
  },
  { name: "verify_submission", params: [{ n: "submission_id", t: "int" }] },
  { name: "claim_reward", params: [{ n: "submission_id", t: "int" }] },
  { name: "close_campaign", params: [{ n: "campaign_id", t: "int" }] },
  { name: "withdraw_remaining", params: [{ n: "campaign_id", t: "int" }] },
];

function convertArg(p, raw) {
  const v = (raw ?? "").trim();
  if (p.t === "int") {
    if (!/^\d+$/.test(v)) throw new Error(`${p.n} must be a whole number`);
    return Number(v);
  }
  if (p.t === "gen") return toWei(v);
  return raw ?? "";
}

const pretty = (x) => (typeof x === "string" ? x : JSON.stringify(plain(x), null, 2));

function Section({ title, startOpen = true, children }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="gg-card gg-box">
      <button className="gg-sec-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {title}
        <span className="gg-chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && children}
    </div>
  );
}

function Row({ m, kind, account, onWrite }) {
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
        if ((p.n === "creator" || p.n === "submitter") && !raw && account) raw = account.address;
        return convertArg(p, raw);
      });
      if (kind === "read") {
        setOut(pretty(await readClient.readContract({ address: CONTRACT_ADDRESS, functionName: m.name, args })));
      } else {
        setOut(await onWrite(m.name, args, m.payable ? toWei(amount) : 0n));
      }
    } catch (e) {
      setOut("Error: " + errText(e));
    }
    setBusy(false);
  }

  return (
    <div>
      <button className="gg-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {m.name}
        {m.payable && <span className="gg-tag">payable</span>}
        <span className="gg-chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="gg-body">
          {m.params.map((p) => (
            <input
              key={p.n}
              className="gg-input"
              placeholder={
                (p.n === "creator" || p.n === "submitter") && account
                  ? `${p.n} (empty = my wallet)`
                  : p.t === "gen" ? `${p.n} (GEN)` : p.n
              }
              value={vals[p.n] ?? ""}
              onChange={(e) => setVals({ ...vals, [p.n]: e.target.value })}
            />
          ))}
          {m.payable && (
            <input className="gg-input" placeholder="amount to send (GEN)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          )}
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

export default function Methods({ account }) {
  const [txs, setTxs] = useState([]);

  async function onWrite(functionName, args, value) {
    const hash = await account.client.writeContract({ address: CONTRACT_ADDRESS, functionName, args, value });
    setTxs((p) => [{ hash, method: functionName, time: new Date().toLocaleTimeString(), status: "pending" }, ...p]);
    const mark = (status) => setTxs((p) => p.map((t) => (t.hash === hash ? { ...t, status } : t)));
    try {
      const receipt = await account.client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 60,
        interval: 4000,
      });
      if (execFailed(receipt)) {
        mark("failed");
        return `Failed: execution error\n${hash}`;
      }
      mark("accepted");
      return `Accepted\n${hash}`;
    } catch (e) {
      mark("failed");
      throw e;
    }
  }

  const color = { accepted: "#15803d", failed: "#b91c1c", pending: "#92400e" };

  return (
    <div>
      <p className="gg-meta" style={{ margin: "0 0 12px" }}>
        Call the contract directly, like in GenLayer Studio.{" "}
        <a href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
          View on explorer
        </a>
      </p>
      <Section title="Read methods">
        {READ_METHODS.map((m) => <Row key={m.name} m={m} kind="read" account={account} onWrite={onWrite} />)}
      </Section>
      <Section title="Write methods">
        {WRITE_METHODS.map((m) => <Row key={m.name} m={m} kind="write" account={account} onWrite={onWrite} />)}
      </Section>
      <Section title={`Transactions (${txs.length})`} startOpen={false}>
        {txs.length === 0 && <div style={{ padding: "12px 18px", fontSize: 14, color: "#64748b" }}>No transactions yet.</div>}
        {txs.map((t) => (
          <div key={t.hash} style={{ padding: "12px 18px", borderTop: "1px solid #eef2f7", fontSize: 13 }}>
            <strong>{t.method}</strong>{" "}
            <span style={{ color: color[t.status], fontWeight: 700 }}>{t.status}</span>
            <span style={{ color: "#94a3b8" }}> · {t.time}</span>
            <div style={{ wordBreak: "break-all", marginTop: 4 }}>
              <a href={`${EXPLORER}/tx/${t.hash}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{t.hash}</a>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
