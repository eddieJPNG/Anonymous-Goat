#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    crypto::bls12_381::{
        Bls12381Fr as Fr, Bls12381G1Affine as G1Affine, Bls12381G2Affine as G2Affine,
    },
    vec, Address, BytesN, Env, Map, Vec, U256,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Groth16Error {
    MalformedVerifyingKey = 0,
    AdminNotSet = 1,
    AlreadyInitialized = 2,
    NotInitialized = 3,
    Unauthorized = 4,
    RootMismatch = 5,
    ElectionMismatch = 6,
    InvalidVote = 7,
    InvalidProof = 8,
    NullifierAlreadyUsed = 9,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    MerkleRoot,
    ElectionId,
    Nullifiers,
    Tally,
}

/// Public vote counts. `gta6` counts `vote == 0`, `zelda` counts `vote == 1`.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Tally {
    pub gta6: u32,
    pub zelda: u32,
}

/// The four public signals of the circuit, in the caller's terms. The contract
/// re-orders them into the snarkjs order `[nullifier, merkleRoot, electionId,
/// vote]` before handing them to the verifier.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PublicInputs {
    pub merkle_root: BytesN<32>,
    pub election_id: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub vote: u32,
}

/// Emitted once per accepted vote. The nullifier is a topic so indexers can
/// spot a replay attempt without decoding the payload.
#[contractevent(topics = ["VoteCast"], data_format = "single-value")]
#[derive(Clone)]
pub struct VoteCast {
    #[topic]
    pub nullifier: BytesN<32>,
    pub vote: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

/// Adds one vote to the matching bucket. Kept as a free function so both
/// options are unit-testable without a full proving round-trip.
fn increment_tally(tally: &mut Tally, vote: u32) {
    if vote == 0 {
        tally.gta6 += 1;
    } else {
        tally.zelda += 1;
    }
}

#[contract]
pub struct Groth16Verifier;

#[contractimpl]
impl Groth16Verifier {
    /// Stores the account allowed to call `upgrade` and `initialize`. Caatinga
    /// passes the deploying identity through `deployArgs: { admin: "${source.address}" }`.
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Returns the account allowed to call `upgrade` and `initialize`.
    pub fn admin(env: Env) -> Result<Address, Groth16Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Groth16Error::AdminNotSet)
    }

    /// Replaces the contract WASM in place, keeping the contract ID. Only the
    /// admin may call it; `ctg upgrade verifier` invokes it after
    /// `ctg zk build --embed-vk` changes the embedded verification key.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Groth16Error> {
        Self::admin(env.clone())?.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    /// Freezes the election parameters: the Merkle root of the eligible voters
    /// and the election id that domains every nullifier.
    ///
    /// `admin` must be the account stored by the constructor and must sign the
    /// call, so no third party can re-point the election after deployment.
    pub fn initialize(
        env: Env,
        admin: Address,
        merkle_root: BytesN<32>,
        election_id: BytesN<32>,
    ) -> Result<(), Groth16Error> {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Groth16Error::AdminNotSet)?;
        if stored_admin != admin {
            return Err(Groth16Error::Unauthorized);
        }
        admin.require_auth();

        if env.storage().instance().has(&DataKey::MerkleRoot) {
            return Err(Groth16Error::AlreadyInitialized);
        }

        env.storage()
            .instance()
            .set(&DataKey::MerkleRoot, &merkle_root);
        env.storage()
            .instance()
            .set(&DataKey::ElectionId, &election_id);
        env.storage()
            .instance()
            .set(&DataKey::Tally, &Tally { gta6: 0, zelda: 0 });
        Ok(())
    }

    /// Current vote counts. Errors before `initialize`, so a caller never
    /// mistakes "not set up yet" for "no votes yet".
    pub fn get_tally(env: Env) -> Result<Tally, Groth16Error> {
        env.storage()
            .instance()
            .get(&DataKey::Tally)
            .ok_or(Groth16Error::NotInitialized)
    }

    /// Accepts a Groth16 proof of eligibility and records the vote.
    ///
    /// Order of checks: election config → public inputs → proof → nullifier →
    /// tally → event. Nothing is written until every check has passed.
    pub fn vote(env: Env, proof: Proof, public_inputs: PublicInputs) -> Result<(), Groth16Error> {
        let PublicInputs {
            merkle_root,
            election_id,
            nullifier,
            vote,
        } = public_inputs;

        // The election must be frozen before any ballot is counted.
        let stored_root: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::MerkleRoot)
            .ok_or(Groth16Error::NotInitialized)?;
        let stored_election: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::ElectionId)
            .ok_or(Groth16Error::NotInitialized)?;

        if merkle_root != stored_root {
            return Err(Groth16Error::RootMismatch);
        }
        if election_id != stored_election {
            return Err(Groth16Error::ElectionMismatch);
        }
        // The circuit already constrains `vote * (vote - 1) === 0`; this is a
        // cheap early exit that keeps a malformed payload out of the pairing.
        if vote > 1 {
            return Err(Groth16Error::InvalidVote);
        }

        // snarkjs orders public signals as outputs first, then public inputs
        // in `{public [...]}` declaration order. `nullifier` is an output, so
        // the order is fixed by the circuit, not by this struct.
        let pub_signals = Vec::from_array(
            &env,
            [
                Fr::from_bytes(nullifier.clone()),
                Fr::from_bytes(merkle_root.clone()),
                Fr::from_bytes(election_id.clone()),
                Fr::from_u256(U256::from_u32(&env, vote)),
            ],
        );

        if !Self::verify_proof_embedded(env.clone(), proof, pub_signals)? {
            return Err(Groth16Error::InvalidProof);
        }

        // One nullifier per (secret, electionId): a second ballot from the
        // same voter is rejected without revealing which leaf it came from.
        let mut nullifiers: Map<BytesN<32>, bool> = env
            .storage()
            .instance()
            .get(&DataKey::Nullifiers)
            .unwrap_or_else(|| Map::new(&env));
        if nullifiers.contains_key(nullifier.clone()) {
            return Err(Groth16Error::NullifierAlreadyUsed);
        }
        nullifiers.set(nullifier.clone(), true);

        let mut tally: Tally = env
            .storage()
            .instance()
            .get(&DataKey::Tally)
            .unwrap_or(Tally { gta6: 0, zelda: 0 });
        increment_tally(&mut tally, vote);

        env.storage()
            .instance()
            .set(&DataKey::Nullifiers, &nullifiers);
        env.storage().instance().set(&DataKey::Tally, &tally);

        VoteCast { nullifier, vote }.publish(&env);
        Ok(())
    }

    pub fn verify_proof(
        env: Env,
        vk: VerificationKey,
        proof: Proof,
        pub_signals: Vec<Fr>,
    ) -> Result<bool, Groth16Error> {
        Self::verify_with_vk(env, vk, proof, pub_signals)
    }

    /// Verifies with the verification key baked into the contract by
    /// `ctg zk build --embed-vk`, which overwrites `src/vk.rs`.
    ///
    /// Prefer this once a circuit is frozen: it removes the VK argument from
    /// every transaction and makes the deployed contract self-contained. Use
    /// `verify_proof` instead while a circuit is still changing.
    pub fn verify_proof_embedded(
        env: Env,
        proof: Proof,
        pub_signals: Vec<Fr>,
    ) -> Result<bool, Groth16Error> {
        let (alpha, beta, gamma, delta, ic) = vk::embedded_vk(&env);
        let vk = VerificationKey {
            alpha,
            beta,
            gamma,
            delta,
            ic,
        };
        Self::verify_with_vk(env, vk, proof, pub_signals)
    }

    fn verify_with_vk(
        env: Env,
        vk: VerificationKey,
        proof: Proof,
        pub_signals: Vec<Fr>,
    ) -> Result<bool, Groth16Error> {
        let bls = env.crypto().bls12_381();

        if pub_signals.len() + 1 != vk.ic.len() {
            return Err(Groth16Error::MalformedVerifyingKey);
        }

        let mut vk_x = vk.ic.get(0).ok_or(Groth16Error::MalformedVerifyingKey)?;
        for (s, v) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
            let prod = bls.g1_mul(&v, &s);
            vk_x = bls.g1_add(&vk_x, &prod);
        }

        let neg_a = -proof.a;
        let vp1 = vec![&env, neg_a, vk.alpha, vk_x, proof.c];
        let vp2 = vec![&env, proof.b, vk.beta, vk.gamma, vk.delta];

        Ok(bls.pairing_check(vp1, vp2))
    }
}

mod test;
mod test_vectors;
// `vk.rs` is emitted by `ctg zk build --embed-vk` and passes `&env` to
// constructors that already take a reference; allow that lint only here so the
// rest of the crate keeps being checked strictly.
#[allow(clippy::needless_borrow)]
mod vk;
