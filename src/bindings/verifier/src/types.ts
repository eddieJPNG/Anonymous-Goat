import { Buffer } from 'buffer';

    /**
 * Struct: Proof
 */
export interface Proof {
  a: Buffer;
  b: Buffer;
  c: Buffer;
}

/**
 * Public vote counts. `gta6` counts `vote == 0`, `zelda` counts `vote == 1`.
 */
export interface Tally {
  gta6: number;
  zelda: number;
}

/**
 * Union: DataKey
 */
 export type DataKey =
  { tag: "Admin"; values: void } |
  { tag: "MerkleRoot"; values: void } |
  { tag: "ElectionId"; values: void } |
  { tag: "Nullifiers"; values: void } |
  { tag: "Tally"; values: void };

/**
 * Emitted once per accepted vote. The nullifier is a topic so indexers can
 * spot a replay attempt without decoding the payload.
 */
export interface VoteCastEvent {
  name: "VoteCast";
  data: {
    nullifier: Buffer;
    vote: number;
  };
}

/**
 * Error Enum: Groth16Error
 */
export const Groth16Error = {
  0 : { message: "MalformedVerifyingKey" },
  1 : { message: "AdminNotSet" },
  2 : { message: "AlreadyInitialized" },
  3 : { message: "NotInitialized" },
  4 : { message: "Unauthorized" },
  5 : { message: "RootMismatch" },
  6 : { message: "ElectionMismatch" },
  7 : { message: "InvalidVote" },
  8 : { message: "InvalidProof" },
  9 : { message: "NullifierAlreadyUsed" }
}

export interface Groth16Error {
  message: string;
}

/**
 * The four public signals of the circuit, in the caller's terms. The contract
 * re-orders them into the snarkjs order `[nullifier, merkleRoot, electionId,
 * vote]` before handing them to the verifier.
 */
export interface PublicInputs {
  election_id: Buffer;
  merkle_root: Buffer;
  nullifier: Buffer;
  vote: number;
}

/**
 * Struct: VerificationKey
 */
export interface VerificationKey {
  alpha: Buffer;
  beta: Buffer;
  delta: Buffer;
  gamma: Buffer;
  ic: Array<Buffer>;
}
    export type ContractEvent = VoteCastEvent;
    