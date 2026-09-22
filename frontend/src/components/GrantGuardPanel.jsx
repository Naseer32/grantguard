// GrantGuardPanel.jsx
//
// Minimal example of a frontend that "genuinely calls the contract and
// handles the full transaction lifecycle" — the quality-bar item most
// submissions skip. Modeled on how BuildersClaw's worker polls GenLayer
// consensus instead of assuming an instant response.
//
// Wire this up with genlayer-js (https://sdk.genlayer.com) — swap the
// TODOs for your actual client calls.

import { useState, useCallback } from "react";

// TODO: replace with your deployed GrantGuard contract address
const CONTRACT_ADDRESS = "0x4aB5f14BF3B95739587124a54A49D9AdaE9c3EdF";

export default function GrantGuardPanel() {
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submissionId, setSubmissionId] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | submitting | pending_consensus | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Step 1: submit_milestone — a normal, fast write call.
  const handleSubmit = useCallback(async () => {
    setStatus("submitting");
    setError(null);
    try {
      // TODO: const tx = await client.writeContract({
      //   address: CONTRACT_ADDRESS,
      //   method: "submit_milestone",
      //   args: [evidenceUrl, description],
      // });
      // const newId = await tx.wait(); // however your SDK exposes the return value

      const newId = 1; // placeholder
      setSubmissionId(newId);

      // Step 2: verify_submission — this is the slow, non-deterministic
      // consensus step. Fire it, then poll get_submission for status
      // instead of blocking the UI on one long call.
      setStatus("pending_consensus");
      // TODO: await client.writeContract({
      //   address: CONTRACT_ADDRESS,
      //   method: "verify_submission",
      //   args: [newId],
      // });

      await pollForResult(newId);
    } catch (err) {
      setError(err.message ?? String(err));
      setStatus("error");
    }
  }, [evidenceUrl, description]);

  // Step 3: poll get_submission until status leaves "pending".
  // Real consensus can take anywhere from seconds to minutes —
  // never assume it's instant.
  const pollForResult = useCallback(async (id) => {
    const maxAttempts = 30;
    const delayMs = 4000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // TODO: const sub = await client.readContract({
      //   address: CONTRACT_ADDRESS,
      //   method: "get_submission",
      //   args: [id],
      // });

      const sub = { status: "verified", confidence: "high", reasoning: "placeholder" };

      if (sub.status !== "pending") {
        setResult(sub);
        setStatus("done");
        return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error(
  `Timed out waiting for validator consensus on submission #${id} (contract ${CONTRACT_ADDRESS})`
);
  }, []);

  return (
    <div style={{ maxWidth: 480, fontFamily: "sans-serif" }}>
      <h2>Submit Milestone Evidence</h2>

      <label>
        Evidence URL
        <input
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://your-deployed-app.com"          style={{ width: "100%" }}
        />
      </label>

      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this evidence demonstrate?"
          style={{ width: "100%" }}
        />
      </label>

      <button onClick={handleSubmit} disabled={status === "submitting" || status === "pending_consensus"}>
        Submit for verification
      </button>

      {/* This block is the part most submissions are missing: a visible,
          honest "still working" state instead of a frozen spinner or a
          fake instant result. */}
      {status === "pending_consensus" && (
        <p>Submission #{submissionId} — validators are reaching consensus…</p>
      )}

      {status === "done" && result && (
        <div>
          <h3>Result: {result.status.toUpperCase()}</h3>
          <p>Confidence: {result.confidence}</p>
          <p>Reasoning: {result.reasoning}</p>
          {/* TODO: link to the actual finalize/verify tx on the GenLayer Studio explorer */}
        </div>
      )}

      {status === "error" && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
