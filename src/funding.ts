import { Server } from "@stellar/stellar-sdk/rpc";
import { appNetwork } from "./network.js";

/** Soroban RPC client for the app's network (account-existence checks). */
const rpcServer = new Server(appNetwork.rpcUrl);

/**
 * - `exists` — the account has a ledger entry (it received XLM) and can source
 *   transactions.
 * - `missing` — no ledger entry: Soroban refuses to simulate anything sourced
 *   by it (`CAATINGA_SIMULATION_ACCOUNT_NOT_FOUND`).
 * - `unknown` — the RPC could not be reached; callers must not guess.
 */
export type AccountState = "exists" | "missing" | "unknown";

/**
 * Whether `publicKey` exists on the network.
 *
 * `getAccount` maps *every* failure to "Account not found", so a broken RPC
 * would masquerade as an unfunded account. A `getNetwork` preflight keeps a
 * network outage from triggering the funding UI.
 */
export async function checkAccount(publicKey: string): Promise<AccountState> {
  try {
    await rpcServer.getNetwork();
  } catch {
    return "unknown";
  }
  try {
    await rpcServer.getAccount(publicKey);
    return "exists";
  } catch {
    return "missing";
  }
}

/**
 * Creates `publicKey` through the network's funding endpoint (the SDF
 * friendbot on testnet, 10,000 XLM — test networks only).
 *
 * Uses the SDK's `fundAddress`, which discovers the endpoint from
 * `getNetwork()`, posts the friendbot's `addr` parameter (the old `account`
 * name is rejected with HTTP 400) and waits for the create-account
 * transaction to be included successfully. Throws with the endpoint's own
 * message when it refuses (e.g. rate limit, account already exists).
 */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  try {
    await rpcServer.fundAddress(publicKey);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    if (/No friendbot URL/i.test(message)) {
      throw new Error(
        `Network "${appNetwork.name}" has no funding endpoint — this button only works on test networks.`
      );
    }
    throw new Error(message);
  }
}
