pragma circom 2.1.6;

include "./anonymous_goat.circom";

// Merkle depth 4 => up to 16 eligible voters (frozen scope).
//
// `nullifier` is a circuit output, so it is public automatically; the public
// inputs below complete the public signal list. snarkjs orders public signals
// as [outputs..., public inputs in declaration order], i.e.
// [nullifier, merkleRoot, electionId, vote].
component main {public [merkleRoot, electionId, vote]} = AnonymousGoat(4);
