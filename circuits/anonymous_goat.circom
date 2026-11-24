pragma circom 2.1.6;

// Poseidon over BLS12-381 (Caatinga's curve). The include path is relative to
// this file: circom resolves includes against the including file, not the CWD.
include "../node_modules/circomlib/circuits/poseidon.circom";

// Hash of two sibling nodes: parent = Poseidon(left, right).
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

// Checks that `leaf` is at position `pathIndices` of the tree whose root is
// `root`, revealing only the path (not the leaf's index among all leaves).
//
// At each level the current node and its sibling are ordered by the index bit:
// index 0 means "current node is the left child", index 1 means "right child".
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    signal hashes[levels + 1];
    hashes[0] <== leaf;

    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        // Each index bit must be 0 or 1; otherwise the swap below is unbounded.
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        // Swap (current, sibling) when the current node is the right child:
        // index 0 keeps the order, index 1 flips it.
        var left = hashes[i] + pathIndices[i] * (pathElements[i] - hashes[i]);
        var right = pathElements[i] + pathIndices[i] * (hashes[i] - pathElements[i]);

        hashers[i] = HashLeftRight();
        hashers[i].left <== left;
        hashers[i].right <== right;
        hashes[i + 1] <== hashers[i].hash;
    }

    // The recomputed root must equal the public root.
    root === hashes[levels];
}

// Proves: "I know `secret` such that Poseidon(secret) is a leaf of the tree
// with root `merkleRoot`, and `nullifier` = Poseidon(secret, electionId)."
//
// Private:  secret, merklePath, merkleIndices
// Public:   merkleRoot, electionId, vote (declared in main.circom)
// Output:   nullifier (public by virtue of being a circuit output)
template AnonymousGoat(levels) {
    signal input secret;
    signal input merklePath[levels];
    signal input merkleIndices[levels];
    signal input merkleRoot;
    signal input electionId;
    signal input vote;
    signal output nullifier;

    // commitment = Poseidon(secret): the voter's leaf in the eligibility tree.
    component commitment = Poseidon(1);
    commitment.inputs[0] <== secret;

    // Merkle inclusion of the commitment under the public root.
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitment.out;
    tree.root <== merkleRoot;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== merklePath[i];
        tree.pathIndices[i] <== merkleIndices[i];
    }

    // nullifier = Poseidon(secret, electionId): unique per (secret, election)
    // pair, so the contract can reject a second vote without learning which
    // leaf voted.
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== electionId;
    nullifier <== nullifierHasher.out;

    // vote must be binary: 0 (GTA 6) or 1 (Zelda).
    vote * (vote - 1) === 0;
}
