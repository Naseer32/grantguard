import { useState, useCallback } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x4aB5f14BF3B95739587124a54A49D9AdaE9c3EdF";

export default function GrantGuardPanel() {
  const [account, setAccount] = useState(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submissionId, setSubmissionId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const connectWallet = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      if (!window.ethereum) {
        throw new Error("No browser wallet found — install MetaMask or a compatible wallet.");
      }
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const client = createClient({ chain: studionet, account: address, provider: window.ethereum });
      await client.initializeConsensusSmartContract();
      setAccount({ address, client });
      setStatus("idle");
    } catch (err) {
      setError(err.message ?? String(err));
      setStatus("error");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!account) {
      setError("Connect your wallet first.");
      setStatus("error");
      return;
    }
    const { client } = account;
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
      setStatus("pending_consensus");

      const verifyTxHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "verify_submission",
        args: [newId],
        value: 0n,
      });
      await client.waitForTransactionReceipt({
        hash: verifyTxHash,
        status: TransactionStatus.FINALIZED,
        retries: 60,
        interval: 5000,
      });

      const sub = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_submission",
        args: [newId],
      });
      setResult(sub);
      setStatus("done");
    } catch (err) {
      setError(err.message ?? String(err));
      setStatus("error");
    }
  }, [account, evidenceUrl, description]);

  return (
    <div style={{ maxWidth: 480, fontFamily: "sans-serif" }}>
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
    </div>
  );
}
