import * as snarkjs from "snarkjs";
import type { SnarkjsProof } from "@caatinga/zk/browser";
import { demoTree, type DemoVoter } from "./demo-tree.js";

/** Served by the `zkArtifactsPlugin` in vite.config.ts. */
export const CIRCUIT_WASM_URL = "/zk-artifacts/main_js/main.wasm";
export const PROVING_KEY_URL = "/zk-artifacts/circuit_final.zkey";

/**
 * Every `signal input` of the circuit — the exact shape of `input.json`.
 * `nullifier` is an output, so it is derived during proving and never appears
 * here. All field elements are decimal strings, snarkjs' wire format.
 */
export interface VoteInput {
  secret: string;
  merklePath: string[];
  merkleIndices: string[];
  merkleRoot: string;
  electionId: string;
  vote: string;
}

/** Builds the circuit input for `voter` casting `vote` (0 = GTA 6, 1 = Zelda). */
export function buildVoteInput(voter: DemoVoter, vote: 0 | 1): VoteInput {
  return {
    secret: voter.secret,
    merklePath: voter.merklePath,
    merkleIndices: voter.merkleIndices,
    merkleRoot: demoTree.merkleRoot,
    electionId: demoTree.electionId,
    vote: String(vote),
  };
}

export interface BrowserProof {
  proof: SnarkjsProof;
  /** snarkjs order: `[nullifier, merkleRoot, electionId, vote]`. */
  publicSignals: string[];
}

/**
 * Generates the Groth16 proof entirely in the browser. snarkjs' browser build
 * fetches the wasm witness calculator and the proving key over HTTP, so both
 * must be reachable at the URLs above.
 */
export async function proveVote(input: VoteInput): Promise<BrowserProof> {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    CIRCUIT_WASM_URL,
    PROVING_KEY_URL
  );

  if (!Array.isArray(publicSignals) || publicSignals.length !== 4) {
    throw new Error(`Expected 4 public signals, got ${publicSignals?.length ?? 0}.`);
  }

  return { proof: proof as SnarkjsProof, publicSignals };
}
