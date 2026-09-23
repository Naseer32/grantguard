import { useState, useCallback, useEffect } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x67D39844cbf8C9eFAE424b3535AC0b1047f5922b";
// GenLayer Studionet — MetaMask has no built-in knowledge of this chain,
// so we have to explicitly ask it to switch (or add) it before signing.
const STUDIONET_CHAIN_ID_HEX = "0xf22f"; // 61999 decimal
const STUDIONET_PARAMS = {
  chainId: STUDIONET_CHAIN_ID_HEX,
  chainName: "GenLayer Studio",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
};

async function ensureStudionet() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [STUDIONET_PARAMS],
      });
    } else {
      throw switchError;
    }
  }
}
const readClient = createClient({ chain: studionet });

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

  const connectWallet = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      if (!window.ethereum) {
        throw new Error("No browser wallet found — install MetaMask or a compatible wallet.");
      }
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureStudionet();
const client = createClient({ chain: studionet, account: address, provider: window.ethereum });
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
      await refreshSubmissions(address);
    } catch (err) {
      setError(err.message ?? String(err));
      setStatus("error");
    }
  }, [account, evidenceUrl, description, refreshSubmissions]);

  return (
    <div style={{ maxWidth: 480, fontFamily: "sans-serif" }}>
      {campaign && (
        <div style={{ background: "#f4f4f4", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem" }}>
          <strong>{campaign.title}</strong>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.9em", color: "#444" }}>{campaign.spec}</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8em", color: "#888" }}>
            {campaign.submission_count} submission(s) so far
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
