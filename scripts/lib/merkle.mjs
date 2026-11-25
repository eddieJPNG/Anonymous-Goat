// Fixed-depth Merkle tree over Poseidon (BLS12-381), matching the circuit's
// MerkleTreeChecker: parent = Poseidon(left, right), index bit 0 = left child.
import { poseidon, toBytes32 } from "./poseidon.mjs";

/** Tree depth fixed by the scope: 4 levels => up to 16 eligible leaves. */
export const DEPTH = 4;
export const NUM_LEAVES = 2 ** DEPTH;

/**
 * commitment = Poseidon(secret) — the voter's leaf in the eligibility tree.
 * @param {bigint|string|number} secret
 * @returns {bigint}
 */
export function commitment(secret) {
  return poseidon([secret]);
}

/**
 * Builds the full tree from exactly NUM_LEAVES leaves.
 * @param {bigint[]} leaves
 * @returns {{root: bigint, levels: bigint[][]}} levels[0] = leaves,
 *   levels[DEPTH] = [root]
 */
export function buildTree(leaves) {
  if (leaves.length !== NUM_LEAVES) {
    throw new Error(`expected ${NUM_LEAVES} leaves, got ${leaves.length}`);
  }
  const levels = [leaves.slice()];
  for (let d = 0; d < DEPTH; d++) {
    const prev = levels[d];
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(poseidon([prev[i], prev[i + 1]]));
    }
    levels.push(next);
  }
  return { root: levels[DEPTH][0], levels };
}

/**
 * Merkle path for a leaf index: siblings bottom-up and the index bits
 * (0 = current node is the left child).
 * @param {bigint[][]} levels
 * @param {number} index
 * @returns {{pathElements: bigint[], pathIndices: bigint[]}}
 */
export function getPath(levels, index) {
  if (index < 0 || index >= NUM_LEAVES) {
    throw new Error(`leaf index out of range: ${index}`);
  }
  const pathElements = [];
  const pathIndices = [];
  let idx = index;
  for (let d = 0; d < DEPTH; d++) {
    const sibling = idx ^ 1;
    pathElements.push(levels[d][sibling]);
    pathIndices.push(BigInt(idx & 1));
    idx >>= 1;
  }
  return { pathElements, pathIndices };
}

/**
 * Recomputes the root from a path (sanity check outside the circuit).
 * @param {bigint} leaf
 * @param {bigint[]} pathElements
 * @param {bigint[]} pathIndices
 * @returns {bigint}
 */
export function computeRoot(leaf, pathElements, pathIndices) {
  let node = leaf;
  for (let d = 0; d < DEPTH; d++) {
    const sib = pathElements[d];
    node = pathIndices[d] === 0n ? poseidon([node, sib]) : poseidon([sib, node]);
  }
  return node;
}

/** Field element -> decimal string (snarkjs input/public signal format). */
export function toSignal(value) {
  return BigInt(value).toString();
}

/** Field element -> 0x-prefixed hex (BytesN<32> for the contract). */
export function toHex32(value) {
  return `0x${toBytes32(value).toString("hex")}`;
}
