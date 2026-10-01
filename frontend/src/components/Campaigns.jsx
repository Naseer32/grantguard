/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { read, send, gen, num, toWei, same, errText } from "../lib.js";
import { Pill, Spin, Err, Note, Field } from "./ui.jsx";

export function CampaignCard({ c, onOpen }) {
  return (
    <button className="gg-card gg-click" onClick={() => onOpen(num(c.id))}>
      <div className="gg-row">
        <strong>{c.title}</strong>
        <Pill kind={c.is_open ? "verified" : ""}>{c.is_open ? "OPEN" : "CLOSED"}</Pill>
      </div>
      <div className="gg-spec">{c.spec}</div>
      <div className="gg-meta">
        Pool {gen(c.pool_balance)} GEN · Reward {gen(c.reward_per_milestone)} GEN ·{" "}
        {num(c.submission_count)} submissions
      </div>
    </button>
  );
}

export function CampaignList({ onOpen, onCreate }) {
  const [items, setItems] = useState(null);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    read("get_campaigns")
      .then((list) => setItems([...list].reverse()))
      .catch((e) => setError(errText(e)));
  }, []);

  const shown = (items ?? []).filter((c) => !onlyOpen || c.is_open);

  return (
    <div>
      <div className="gg-steps">
        <div className="gg-step"><b>1. Create</b><small>Set a spec and fund a GEN reward pool.</small></div>
        <div className="gg-step"><b>2. Submit</b><small>Anyone submits a public URL as evidence.</small></div>
        <div className="gg-step"><b>3. Verify</b><small>GenLayer validators judge it against the spec.</small></div>
        <div className="gg-step"><b>4. Claim</b><small>Verified submitters claim the reward.</small></div>
      </div>

      <div className="gg-row" style={{ margin: "18px 0 12px" }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>Campaigns</h2>
        <label className="gg-check">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Open only
        </label>
      </div>

      <Err>{error}</Err>
      {items === null && !error && <Spin>Loading campaigns…</Spin>}
      {items && shown.length === 0 && (
        <div className="gg-card" style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 12px", color: "#64748b" }}>No campaigns here yet.</p>
          <button className="gg-btn sm" onClick={onCreate}>Create the first one</button>
        </div>
      )}
      {shown.map((c) => (
        <CampaignCard key={num(c.id)} c={c} onOpen={onOpen} />
      ))}
    </div>
  );
}

export function CreateCampaign({ account, onCreated }) {
  const [title, setTitle] = useState("");
  const [spec, setSpec] = useState("");
  const [reward, setReward] = useState("0.1");
  const [funding, setFunding] = useState("0.3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      if (!title.trim() || !spec.trim()) throw new Error("Title and spec are required.");
      const r = toWei(reward);
      const f = toWei(funding);
      if (r <= 0n) throw new Error("Reward must be greater than 0.");
      if (f < r) throw new Error("Funding must cover at least one reward.");
      setBusy(true);
      await send(account, "create_campaign", [title.trim(), spec.trim(), r], f);
      const count = num(await read("get_campaign_count"));
      setBusy(false);
      onCreated(count);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  if (!account) return <Note>Connect your wallet (top right) to create a campaign.</Note>;

  return (
    <div className="gg-card">
      <h2>Create a campaign</h2>
      <Field label="Title">
        <input className="gg-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ship a public demo" />
      </Field>
      <Field
        label="Spec: what counts as done"
        hint="Validators judge the evidence page against this text. Make it specific and checkable from a public web page."
      >
        <textarea className="gg-input" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="The evidence URL must be a public page that shows ..." />
      </Field>
      <Field label="Reward per milestone (GEN)">
        <input className="gg-input" inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value)} />
      </Field>
      <Field label="Funding to deposit (GEN)" hint="Must cover at least one reward. You can top up later.">
        <input className="gg-input" inputMode="decimal" value={funding} onChange={(e) => setFunding(e.target.value)} />
      </Field>
      <button className="gg-btn" onClick={submit} disabled={busy}>
        {busy ? "Creating…" : "Create and fund campaign"}
      </button>
      {busy && <Spin>Waiting for the network to accept your transaction…</Spin>}
      <Err>{error}</Err>
    </div>
  );
}

export function Mine({ account, onOpen }) {
  const [camps, setCamps] = useState(null);
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState("");
  const address = account?.address;

  useEffect(() => {
    if (!address) return;
    Promise.all([
      read("get_campaigns_by_creator", [address]),
      read("get_submissions_by_submitter", [address]),
    ])
      .then(([c, s]) => {
        setCamps([...c].reverse());
        setSubs([...s].reverse());
      })
      .catch((e) => setError(errText(e)));
  }, [address]);

  if (!address) return <Note>Connect your wallet (top right) to see your activity.</Note>;

  return (
    <div>
      <Err>{error}</Err>
      <h2 style={{ fontSize: 19 }}>My campaigns</h2>
      {camps === null && !error && <Spin>Loading…</Spin>}
      {camps && camps.length === 0 && <div className="gg-card gg-meta">You have not created a campaign yet.</div>}
      {camps && camps.map((c) => <CampaignCard key={num(c.id)} c={c} onOpen={onOpen} />)}

      <h2 style={{ fontSize: 19, marginTop: 24 }}>My submissions</h2>
      {subs && subs.length === 0 && <div className="gg-card gg-meta">You have not submitted evidence yet.</div>}
      {subs && subs.map((s) => (
        <button key={num(s.id)} className="gg-card gg-click" onClick={() => onOpen(num(s.campaign_id))}>
          <div className="gg-row">
            <strong>Submission #{num(s.id)} · Campaign #{num(s.campaign_id)}</strong>
            <span>
              <Pill kind={s.status}>{String(s.status).toUpperCase()}</Pill>
              {s.paid && <> <Pill kind="verified">PAID</Pill></>}
            </span>
          </div>
          <div className="gg-url">{s.evidence_url}</div>
          {same(s.submitter, address) && s.status === "verified" && !s.paid && (
            <div className="gg-meta" style={{ color: "#15803d" }}>Ready to claim: open the campaign.</div>
          )}
        </button>
      ))}
    </div>
  );
}
