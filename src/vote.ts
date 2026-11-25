import { formatCaatingaError } from "@caatinga/core/browser";
import { DEFAULT_READ_SOURCE_ACCOUNT } from "@caatinga/client";
import { caatingaClient } from "./caatinga.js";
import type { Proof, PublicInputs, Tally } from "./bindings/verifier/src/types.js";

/**
 * `Groth16Error` codes from `contracts/verifier/src/lib.rs`, mapped to what a
 * voter actually needs to read. `vote` surfaces them during simulation as
 * `HostError: Error(Contract, #N)`.
 */
const CONTRACT_ERRORS: Record<number, string> = {
  0: "The verifier's embedded verification key is malformed. Contact the operator.",
  1: "The contract has no admin set.",
  2: "The election is already initialized.",
  3: "The election is not initialized yet — no votes can be counted.",
  4: "Only the election admin may run this action.",
  5: "Merkle root mismatch: this proof was generated for a different eligibility list.",
  6: "Election id mismatch: this proof belongs to a different election.",
  7: "Invalid vote: only 0 (GTA 6) or 1 (Zelda) are accepted.",
  8: "Invalid proof: the verifier rejected the Groth16 proof. Check that the circuit artifacts match the deployed contract, then generate the proof again.",
  9: "Duplicate vote: this elector has already voted in this election (nullifier already used).",
};

const CONTRACT_ERROR_NAMES = new Map(
  Object.entries({
    MalformedVerifyingKey: 0,
    AdminNotSet: 1,
    AlreadyInitialized: 2,
    NotInitialized: 3,
    Unauthorized: 4,
    RootMismatch: 5,
    ElectionMismatch: 6,
    InvalidVote: 7,
    InvalidProof: 8,
    NullifierAlreadyUsed: 9,
  }).map(([name, code]) => [name, code as number])
);

/** Walks `message`/`hint`/`cause` chains, collecting every readable fragment. */
function collectText(value: unknown, depth = 0, seen = new Set<unknown>()): string {  if (depth > 6 || value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value !== "object" || seen.has(value)) {
    return "";
  }
  seen.add(value);

  const record = value as Record<string, unknown>;
  const fragments: string[] = [];
  for (const key of ["message", "hint", "details", "detail", "error", "data", "cause"]) {
    const fragment = collectText(record[key], depth + 1, seen);
    if (fragment) {
      fragments.push(fragment);
    }
  }
  return fragments.join(" ");
}

/**
 * Turns a failed `vote` call into something a person can act on. Prefers the
 * contract error code (so "invalid proof" and "duplicate vote" are unmistakable)
 * and falls back to the Caatinga-formatted error.
 */
export function describeVoteError(caught: unknown): string {
  const evidence = collectText(caught);

  // The wallet's account has no ledger entry (never funded): the simulation
  // fails before reaching the contract. The vote panel offers the fix.
  if (/CAATINGA_SIMULATION_ACCOUNT_NOT_FOUND|Account not found:/i.test(evidence)) {
    return (
      "This wallet account has no XLM, so it does not exist on this network yet and cannot " +
      'submit transactions. Use the "Fund testnet account" button in the vote panel, or ' +
      "switch to a funded account in your wallet, then try again."
    );
  }

  const codeMatch = evidence.match(/Error\(Contract,\s*#(\d+)\)/);
  if (codeMatch) {
    const code = Number(codeMatch[1]);
    const message = CONTRACT_ERRORS[code];
    if (message) {
      return message;
    }
  }

  for (const [name, code] of CONTRACT_ERROR_NAMES) {
    if (evidence.includes(name)) {
      return CONTRACT_ERRORS[code];
    }
  }

  return formatCaatingaError(caught);
}

export interface CastVoteResult {
  status: string;
  transactionHash?: string;
}

/**
 * Signs and submits `vote` through the connected wallet. Contract rejections
 * (invalid proof, duplicate vote, …) happen during simulation, i.e. before the
 * wallet prompt, and are thrown as errors with a human-readable message.
 */
export async function castVote(
  proof: Proof,
  publicInputs: PublicInputs
): Promise<CastVoteResult> {
  const result = await caatingaClient.contract("verifier").invoke("vote", {
    proof,
    public_inputs: publicInputs,
  });

  if (result.status === "failed") {
    throw new Error("The vote transaction failed on-chain.");
  }

  return { status: result.status, transactionHash: result.transactionHash };
}

/** Reads the public tally. Throws if the election was never initialized. */
export async function fetchTally(): Promise<Tally> {
  // Read-only call pinned to the canonical placeholder source instead of the
  // connected wallet: a wallet that was never funded has no ledger entry, and
  // using it as the simulation source fails with
  // CAATINGA_SIMULATION_ACCOUNT_NOT_FOUND — which would blank the scoreboard
  // for exactly the visitors who need it most. `get_tally` never needs the
  // caller's identity, and the placeholder is never sent to the RPC (the SDK
  // builds the transaction against a local null account).
  return caatingaClient.contract("verifier").read<Tally>("get_tally", {
    sourceAccount: DEFAULT_READ_SOURCE_ACCOUNT,
  });
}
