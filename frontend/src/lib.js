import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const CONTRACT_ADDRESS = "0x849973aB0AA7e353c8AE6eBD5B53C8dAf8281979";
export const EXPLORER = "https://explorer-bradbury.genlayer.com";
export const readClient = createClient({ chain: testnetBradbury });

// genlayer-js can return Map / bigint; make everything plain.
export function plain(x) {
  if (typeof x === "bigint") return x.toString();
  if (x instanceof Uint8Array) return "0x" + [...x].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (x && typeof x === "object" && x.bytes instanceof Uint8Array) return plain(x.bytes);
  if (x instanceof Map) return Object.fromEntries([...x].map(([k, v]) => [k, plain(v)]));
  if (Array.isArray(x)) return x.map(plain);
  if (x && typeof x === "object") {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, plain(v)]));
  }
  return x;
}

export async function read(functionName, args = []) {
  return plain(await readClient.readContract({ address: CONTRACT_ADDRESS, functionName, args }));
}

export const num = (v) => Number(v ?? 0);
export const gen = (wei) => Number((Number(wei) / 1e18).toFixed(4));
export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const same = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();
export const isHttp = (u) => /^https?:\/\//i.test(String(u ?? ""));
export const errText = (e) => String(e?.message ?? e).slice(0, 300);

// "0.5" -> 500000000000000000n (no floating point)
export function toWei(v) {
  const s = String(v ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`"${v}" is not a valid GEN amount`);
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole + frac.padEnd(18, "0").slice(0, 18));
}

export function execFailed(r) {
  const name = String(
    r?.txExecutionResultName ?? r?.consensus_data?.leader_receipt?.[0]?.execution_result ?? ""
  ).toUpperCase();
  return name.includes("ERROR");
}

// Send a write transaction and wait until validators accept it.
export async function send(account, functionName, args = [], value = 0n) {
  const hash = await account.client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value,
  });
  const receipt = await account.client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 60,
    interval: 4000,
  });
  if (execFailed(receipt)) {
    throw new Error("The contract rejected this action (execution error).");
  }
  return hash;
}
