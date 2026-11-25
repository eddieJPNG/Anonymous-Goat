import { Buffer } from "buffer";
import {
  concatG1Bytes,
  concatG2Bytes,
  serializeProof,
  type SnarkjsProof,
} from "@caatinga/zk/browser";
import type { Proof, PublicInputs } from "../bindings/verifier/src/types.js";

/**
 * Decimal field element → 32-byte big-endian `BytesN<32>`, the encoding the
 * contract stores and compares. The circuit's public signals arrive as decimal
 * strings, so this is the only place that converts them for the host.
 */
export function fieldToBytes32(value: string): Buffer {
  let hex: string;
  try {
    hex = BigInt(value).toString(16);
  } catch {
    throw new Error(`Not a field element: ${value}`);
  }
  if (hex.startsWith("-") || hex.length > 64) {
    throw new Error(`Field element does not fit in 32 bytes: ${value}`);
  }
  return Buffer.from(hex.padStart(64, "0"), "hex");
}

/**
 * snarkjs proof → the contract's `Proof` struct.
 *
 * Both encodings are big-endian and match the Soroban host:
 *   G1 → x(48) || y(48)                                   => 96 bytes
 *   G2 → x.c1(48) || x.c0(48) || y.c1(48) || y.c0(48)     => 192 bytes
 * `serializeProof` already swaps snarkjs' `[c0, c1]` order into the host's
 * `[c1, c0]`, so only concatenation is left here.
 */
export function toBindingProof(proof: SnarkjsProof): Proof {
  const serialized = serializeProof(proof);
  const binding: Proof = {
    a: Buffer.from(concatG1Bytes(serialized.a)),
    b: Buffer.from(concatG2Bytes(serialized.b)),
    c: Buffer.from(concatG1Bytes(serialized.c)),
  };

  if (binding.a.length !== 96 || binding.b.length !== 192 || binding.c.length !== 96) {
    throw new Error(
      `Unexpected proof point sizes: a=${binding.a.length} b=${binding.b.length} c=${binding.c.length}`
    );
  }
  return binding;
}

/**
 * snarkjs public signals → the contract's `PublicInputs` struct.
 *
 * snarkjs order is `[nullifier, merkleRoot, electionId, vote]` (output first,
 * then `{public [...]}` declaration order); `PublicInputs` re-orders them into
 * the named fields the contract expects.
 */
export function toPublicInputs(publicSignals: string[]): PublicInputs {
  if (publicSignals.length !== 4) {
    throw new Error(`Expected 4 public signals, got ${publicSignals.length}.`);
  }
  const [nullifier, merkleRoot, electionId, vote] = publicSignals;
  const voteIndex = Number(vote);
  if (voteIndex !== 0 && voteIndex !== 1) {
    throw new Error(`Circuit produced a non-binary vote: ${vote}`);
  }

  return {
    election_id: fieldToBytes32(electionId),
    merkle_root: fieldToBytes32(merkleRoot),
    nullifier: fieldToBytes32(nullifier),
    vote: voteIndex,
  };
}
