/* eslint-disable react/prop-types */
import { useEffect, useState, useCallback } from "react";
import { read, send, gen, num, toWei, short, same, isHttp, errText } from "../lib.js";
import { Pill, Spin, Err, Note, Field } from "./ui.jsx";

export default function CampaignView({ id, account, onBack }) {
  const [c, setC] = useState(null);
  const [subs, setSubs] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [topUp, setTopUp] = useState("");

  const load = useCallback(async () => {
    try {
      const [camp, list] = await Promise.all([
        read("get_campaign", [id]),
        read("get_campaign_submissions", [id]),
      ]);
      setC(camp);
      setSubs([...list].reverse());
    } catch (e) {
      setError(errText(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(label, fn) {
    setError("");
    setBusy(label);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errText(e));
    }
    setBusy("");
  }

  if (!c) {
    return (
      <div>
        <button className="gg-back" onClick={onBack}>← Back</button>
        <Err>{error}</Err>
        {!error && <Spin>Loading campaign…</Spin>}
      </div>
    );
  }

  const me = account?.address;
  const isCreator = same(me, c.creator);

  return (
    <div>
      <button className="gg-back" onClick={onBack}>← All campaigns</button>

      <div className="gg-card">
        <div className="gg-row">
          <Pill kind={c.is_open ? "verified" : ""}>{c.is_open ? "OPEN" : "CLOSED"}</Pill>
          <span className="gg-meta">Campaign #{num(c.id)} · by {isCreator ? "you" : short(c.creator)}</span>
        </div>
        <h2 style={{ margin: "8px 0 6px" }}>{c.title}</h2>
        <div className="gg-spec">{c.spec}</div>
        <div className="gg-stats">
          <div className="gg-stat"><b>{gen(c.pool_balance)} GEN</b><small>Pool balance</small></div>
          <div className="gg-stat"><b>{gen(c.reward_per_milestone)} GEN</b><small>Reward per milestone</small></div>
          <div className="gg-stat"><b>{num(c.submission_count)}</b><small>Submissions</small></div>
        </div>
      </div>

      {busy && <Spin>{busy}</Spin>}
      <Err>{error}</Err>

      {isCreator && (
        <div className="gg-card">
          <h2>Manage campaign</h2>
          {c.is_open ? (
            <>
              <Field label="Add GEN to the pool">
                <input className="gg-input" inputMode="decimal" value={topUp} onChange={(e) => setTopUp(e.target.value)} placeholder="0.1" />
              </Field>
              <button className="gg-btn sm" disabled={!!busy || !topUp.trim()} onClick={() => act("Adding funds…", async () => {
                await send(account, "fund_campaign", [id], toWei(topUp));
                setTopUp("");
              })}>Add funds</button>
              <button className="gg-btn sm ghost" disabled={!!busy} onClick={() => act("Closing campaign…", () => send(account, "close_campaign", [id]))}>
                Close campaign
              </button>
            </>
          ) : (
            <>
              <Note>Closed. You can withdraw the part of the pool that is not reserved for pending or unclaimed submissions.</Note>
              <button className="gg-btn sm" disabled={!!busy} onClick={() => act("Withdrawing…", () => send(account, "withdraw_remaining", [id]))}>
                Withdraw remaining
              </button>
            </>
          )}
        </div>
      )}

      {!isCreator && c.is_open && (
        <div className="gg-card">
          <h2>Submit evidence</h2>
          {!account ? (
            <Note>Connect your wallet (top right) to submit evidence.</Note>
          ) : (
            <>
              <Field label="Evidence URL" hint="A public page validators can open (a deployed app, a repo, a doc).">
                <input className="gg-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
              </Field>
              <Field label="Description">
                <textarea className="gg-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What does this evidence show?" />
              </Field>
              <button className="gg-btn" disabled={!!busy || !isHttp(url)} onClick={() => act("Submitting your evidence…", async () => {
                await send(account, "submit_milestone", [id, url.trim(), desc.trim()]);
                setUrl("");
                setDesc("");
              })}>
                Submit evidence
              </button>
              {url.trim() && !isHttp(url) && <div className="gg-hint">The URL must start with http:// or https://</div>}
            </>
          )}
        </div>
      )}
      {isCreator && c.is_open && <Note>You created this campaign, so you cannot submit to it. Use another wallet to test.</Note>}
      {!c.is_open && !isCreator && <Note>This campaign is closed to new submissions.</Note>}

      <div className="gg-card">
        <h2>Submissions ({subs.length})</h2>
        {subs.length === 0 && <div className="gg-meta">No submissions yet.</div>}
        {subs.map((s) => {
          const mine = same(me, s.submitter);
          return (
            <div key={num(s.id)} className="gg-sub-item">
              <div className="gg-row">
                <strong>#{num(s.id)} · {mine ? "you" : short(s.submitter)}</strong>
                <span>
                  <Pill kind={s.status}>{String(s.status).toUpperCase()}</Pill>
                  {s.paid && <> <Pill kind="verified">PAID</Pill></>}
                </span>
              </div>
              {isHttp(s.evidence_url)
                ? <a className="gg-url" href={s.evidence_url} target="_blank" rel="noreferrer noopener">{s.evidence_url}</a>
                : <div className="gg-url">{s.evidence_url}</div>}
              {s.description && <div className="gg-desc">{s.description}</div>}
              {s.reasoning && <div className="gg-reason">{s.confidence} confidence: {s.reasoning}</div>}
              {s.status === "pending" && account && (
                <button className="gg-btn sm" disabled={!!busy} onClick={() => act(`Verifying #${num(s.id)}: validators are reaching consensus. This can take a few minutes.`, () => send(account, "verify_submission", [num(s.id)]))}>
                  Verify with validators
                </button>
              )}
              {s.status === "verified" && !s.paid && mine && (
                <button className="gg-btn sm" disabled={!!busy} onClick={() => act("Claiming your reward…", () => send(account, "claim_reward", [num(s.id)]))}>
                  Claim {gen(c.reward_per_milestone)} GEN
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
