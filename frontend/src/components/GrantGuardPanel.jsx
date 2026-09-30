// GrantGuardPanel.jsx
//
// Real genlayer-js wiring against a deployed GrantGuard contract, on
// GenLayer Bradbury testnet. Shows the campaign spec, pool balance, and
// reward per milestone on load (read-only, no wallet needed), lets a
// connected wallet submit + verify evidence with a visible pending
// state, lists that wallet's past submissions and their verdicts, and
// lets a verified submitter claim their GEN reward.
//
// Requires: npm install genlayer-js
// Requires a browser wallet (MetaMask or compatible) for signing.

import { useState, useCallback, useEffect } from "react";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x8Fc59D3a4dB29418eEb181964Ac62f39Bdb21247";

const BRADBURY_CHAIN_ID_HEX = "0x107d"; // 4221 decimal
const BRADBURY_PARAMS = {
  chainId: BRADBURY_CHAIN_ID_HEX,
  chainName: "GenLayer Bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
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
    <div style={{ maxWidth: 480, fontFamily: "sans-serif" }}>
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
    </div>
  );
}
