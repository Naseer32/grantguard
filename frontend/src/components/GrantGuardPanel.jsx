import { useState } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x3ff31Fa386b3ECb4259762e2dDdb78411E7Abf31";
const CHAIN_ID = "0xf22f";

const CHAIN_PARAMS = {
  chainId: CHAIN_ID,
  chainName: "GenLayer Studio",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
};

async function ensureStudionet() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID }],
    });
  } catch (error) {
    if (error.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [CHAIN_PARAMS],
      });
    } else {
      throw error;
    }
  }
}

function Card({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 22,
        marginBottom: 18,
        background: "#fff",
        boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
      }}
    >
      <h3
        style={{
          margin: "0 0 18px",
          fontSize: 17,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 7,
          color: "#374151",
        }}
      >
        {label}
      </div>
      <input
        {...props}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "12px 14px",
          border: "1px solid #d1d5db",
          borderRadius: 11,
          background: "#f9fafb",
          color: "#111827",
          outline: "none",
          fontSize: 14,
        }}
      />
    </label>
  );
}

function Textarea({ label, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 7,
          color: "#374151",
        }}
      >
        {label}
      </div>
      <textarea
        {...props}
        rows={4}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "12px 14px",
          border: "1px solid #d1d5db",
          borderRadius: 11,
          background: "#f9fafb",
          color: "#111827",
          resize: "vertical",
          outline: "none",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      />
    </label>
  );
}

function Button({ children, variant = "primary", ...props }) {
  const styles = {
    primary: {
      background: "#16a34a",
      color: "#fff",
      border: "1px solid #16a34a",
    },
    dark: {
      background: "#111827",
      color: "#fff",
      border: "1px solid #111827",
    },
    danger: {
      background: "#fff",
      color: "#dc2626",
      border: "1px solid #fecaca",
    },
    warning: {
      background: "#fff",
      color: "#b45309",
      border: "1px solid #fde68a",
    },
    secondary: {
      background: "#f8fafc",
      color: "#374151",
      border: "1px solid #e5e7eb",
    },
  };

  return (
    <button
      {...props}
      style={{
        width: "100%",
        padding: "11px 15px",
        borderRadius: 11,
        fontSize: 13,
        fontWeight: 750,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,
        transition: "all 0.15s ease",
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

export default function GrantGuardPanel() {
  const [account, setAccount] = useState("");
  const [client, setClient] = useState(null);
  const [readClient] = useState(() => createClient({ chain: studionet }));

  const [grantId, setGrantId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");

  const [grantTitle, setGrantTitle] = useState("");
  const [grantDescription, setGrantDescription] = useState("");

  const [recipient, setRecipient] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [requirements, setRequirements] = useState("");
  const [reward, setReward] = useState("");

  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceDescription, setEvidenceDescription] = useState("");

  const [loadedGrant, setLoadedGrant] = useState(null);
  const [loadedMilestone, setLoadedMilestone] = useState(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const run = async (action) => {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await action();
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      throw new Error("No compatible browser wallet found.");
    }

    await ensureStudionet();

    const [address] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    const newClient = createClient({
      chain: studionet,
      account: address,
      provider: window.ethereum,
    });

    await newClient.initializeConsensusSmartContract();

    setAccount(address);
    setClient(newClient);
    setMessage("Wallet connected.");
  };

  const waitFor = async (hash) => {
    await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
      retries: 60,
      interval: 5000,
    });
  };

  const createGrant = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "create_grant",
        args: [grantTitle, grantDescription],
        value: 0n,
      });

      await waitFor(hash);

      setMessage("Grant created successfully. Use the next grant ID in the form.");
    });

  const addMilestone = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");
      if (!grantId) throw new Error("Enter a grant ID first.");

      const amount = BigInt(reward);

      if (amount <= 0n) {
        throw new Error("Reward must be greater than 0.");
      }

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "add_milestone",
        args: [grantId, recipient, milestoneTitle, requirements],
        value: amount,
      });

      await waitFor(hash);

      setMessage("Milestone created successfully. Use the next milestone ID in the form.");
    });

  const freezeRequirements = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "freeze_milestone_requirements",
        args: [grantId, milestoneId],
        value: 0n,
      });

      await waitFor(hash);
      setMessage("Milestone requirements frozen.");
    });

  const submitEvidence = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_evidence",
        args: [
          account,
          grantId,
          milestoneId,
          evidenceUrl,
          evidenceDescription,
        ],
        value: 0n,
      });

      await waitFor(hash);
      setMessage("Evidence submitted.");
    });

  const requestVerification = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "request_verification",
        args: [account, grantId, milestoneId],
        value: 0n,
      });

      await waitFor(hash);
      setMessage("Verification requested.");
    });

  const verifyMilestone = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "verify_milestone",
        args: [account, grantId, milestoneId],
        value: 0n,
      });

      await waitFor(hash);
      setMessage("GenLayer verification completed.");
    });

  const releaseMilestone = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "release_milestone",
        args: [account, grantId, milestoneId],
        value: 0n,
      });

      await waitFor(hash);
      setMessage("Milestone reward released.");
    });

  const challengeMilestone = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "challenge_milestone",
        args: [account, grantId, milestoneId],
        value: 0n,
      });

      await waitFor(hash);
      setMessage("Milestone challenged.");
    });

  const finalizeMilestone = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "finalize_milestone",
        args: [account, grantId, milestoneId],
        value: 0n,
      });

      await waitFor(hash);
      setMessage("Milestone finalized.");
    });

  const loadGrant = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const data = await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_grant",
        args: [account, grantId],
      });

      setLoadedGrant(data);
    });

  const loadMilestone = () =>
    run(async () => {
      if (!client) throw new Error("Connect your wallet first.");

      const data = await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_milestone",
        args: [account, grantId, milestoneId],
      });

      setLoadedMilestone(data);
    });

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "sans-serif",
        color: "#111827",
      }}
    >
      <Card title="Wallet">
        {!account ? (
          <Button variant="dark" onClick={() => run(connectWallet)} disabled={busy}>
            {busy ? "Connecting..." : "Connect Wallet"}
          </Button>
        ) : (
          <div>
            <strong>Connected</strong>
            <div style={{ fontSize: 12, marginTop: 5 }}>{account}</div>
          </div>
        )}
      </Card>

      <Card title="Create Grant">
        <Input
          label="Title"
          value={grantTitle}
          onChange={(e) => setGrantTitle(e.target.value)}
          placeholder="Grant title"
        />
        <Textarea
          label="Description"
          value={grantDescription}
          onChange={(e) => setGrantDescription(e.target.value)}
          placeholder="What is this grant for?"
        />
        <Button onClick={createGrant} disabled={!account || busy}>
          Create Grant
        </Button>
      </Card>

      <Card title="Add Milestone">
        <Input
          label="Grant ID"
          value={grantId}
          onChange={(e) => setGrantId(e.target.value)}
          placeholder="grant-1"
        />
        <Input
          label="Recipient Address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
        />
        <Input
          label="Milestone Title"
          value={milestoneTitle}
          onChange={(e) => setMilestoneTitle(e.target.value)}
          placeholder="Working frontend"
        />
        <Textarea
          label="Requirements"
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder="Frontend must connect wallet and submit evidence."
        />
        <Input
          label="Reward in wei"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          placeholder="1000000000000000000"
        />
        <Button onClick={addMilestone} disabled={!account || busy}>
          Fund Milestone
        </Button>
      </Card>

      <Card title="Milestone Workflow">
        <Input
          label="Milestone ID"
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
          placeholder="milestone-1"
        />

        <div style={{ display: "grid", gap: 8 }}>
          <Button variant="secondary" onClick={freezeRequirements} disabled={!account || busy}>
            Freeze Requirements
          </Button>

          <Input
            label="Evidence URL"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://..."
          />

          <Textarea
            label="Evidence Description"
            value={evidenceDescription}
            onChange={(e) => setEvidenceDescription(e.target.value)}
            placeholder="Explain what the evidence proves."
          />

          <Button onClick={submitEvidence} disabled={!account || busy}>
            Submit Evidence
          </Button>

          <Button variant="warning" onClick={requestVerification} disabled={!account || busy}>
            Request Verification
          </Button>

          <Button onClick={verifyMilestone} disabled={!account || busy}>
            Run GenLayer Verification
          </Button>

          <Button onClick={releaseMilestone} disabled={!account || busy}>
            Release Verified Reward
          </Button>

          <Button variant="danger" onClick={challengeMilestone} disabled={!account || busy}>
            Challenge Rejection
          </Button>

          <Button variant="danger" onClick={finalizeMilestone} disabled={!account || busy}>
            Finalize Rejected Milestone
          </Button>
        </div>
      </Card>

      <Card title="View State">
        <Input
          label="Grant ID"
          value={grantId}
          onChange={(e) => setGrantId(e.target.value)}
          placeholder="grant-1"
        />

        <Input
          label="Milestone ID"
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
          placeholder="milestone-1"
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onClick={loadGrant}
            disabled={!account || !grantId || busy}
          >
            Load Grant
          </Button>

          <Button
            variant="secondary"
            onClick={loadMilestone}
            disabled={!account || !grantId || !milestoneId || busy}
          >
            Load Milestone
          </Button>
        </div>

        {loadedGrant && (
          <pre
            style={{
              marginTop: 15,
              padding: 12,
              background: "#f3f4f6",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(loadedGrant, null, 2)}
          </pre>
        )}

        {loadedMilestone && (
          <pre
            style={{
              marginTop: 15,
              padding: 12,
              background: "#f3f4f6",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(loadedMilestone, null, 2)}
          </pre>
        )}
      </Card>

      {busy && <p>Processing transaction...</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
