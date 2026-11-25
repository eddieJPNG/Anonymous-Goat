#![cfg(test)]
extern crate std;

use ark_bls12_381::{Fq, Fq2};
use ark_serialize::CanonicalSerialize;
use core::str::FromStr;
use soroban_sdk::{
    crypto::bls12_381::{
        Bls12381Fr as Fr, Bls12381G1Affine as G1Affine, Bls12381G2Affine as G2Affine,
        G1_SERIALIZED_SIZE, G2_SERIALIZED_SIZE,
    },
    symbol_short,
    testutils::{
        Address as _, AuthorizedFunction, AuthorizedInvocation, Events as _, MockAuth,
        MockAuthInvoke,
    },
    vec, Address, Bytes, BytesN, Env, IntoVal, Symbol, Vec, U256,
};

use crate::{
    test_vectors as tv, DataKey, Groth16Error, Groth16Verifier, Groth16VerifierClient, Proof,
    PublicInputs, Tally, VerificationKey,
};

fn g1_from_coords(env: &Env, x: &str, y: &str) -> G1Affine {
    let ark_g1 = ark_bls12_381::G1Affine::new(Fq::from_str(x).unwrap(), Fq::from_str(y).unwrap());
    let mut buf = [0u8; G1_SERIALIZED_SIZE];
    ark_g1.serialize_uncompressed(&mut buf[..]).unwrap();
    G1Affine::from_array(env, &buf)
}

fn g2_from_coords(env: &Env, x1: &str, x2: &str, y1: &str, y2: &str) -> G2Affine {
    let x = Fq2::new(Fq::from_str(x1).unwrap(), Fq::from_str(x2).unwrap());
    let y = Fq2::new(Fq::from_str(y1).unwrap(), Fq::from_str(y2).unwrap());
    let ark_g2 = ark_bls12_381::G2Affine::new(x, y);
    let mut buf = [0u8; G2_SERIALIZED_SIZE];
    ark_g2.serialize_uncompressed(&mut buf[..]).unwrap();
    G2Affine::from_array(env, &buf)
}

fn create_client(e: &Env) -> Groth16VerifierClient<'_> {
    let admin = Address::generate(e);
    Groth16VerifierClient::new(e, &e.register(Groth16Verifier {}, (admin,)))
}

// Smallest WASM module the host accepts as a contract: only the
// `contractenvmetav0` custom section declaring interface version 22.0.
const MINIMAL_CONTRACT_WASM: [u8; 40] = [
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic + version
    0x00, 0x1e, // custom section, 30 bytes
    0x11, b'c', b'o', b'n', b't', b'r', b'a', b'c', b't', b'e', b'n', b'v', b'm', b'e', b't', b'a',
    b'v', b'0', // name
    0x00, 0x00, 0x00, 0x00, // SC_ENV_META_KIND_INTERFACE_VERSION
    0x00, 0x00, 0x00, 0x16, // protocol 22
    0x00, 0x00, 0x00, 0x00, // pre-release 0
];

#[test]
fn constructor_stores_admin() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let client =
        Groth16VerifierClient::new(&env, &env.register(Groth16Verifier {}, (admin.clone(),)));

    assert_eq!(client.admin(), admin);
}

#[test]
fn upgrade_requires_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(Groth16Verifier {}, (admin.clone(),));
    let client = Groth16VerifierClient::new(&env, &contract_id);
    let new_wasm_hash = env
        .deployer()
        .upload_contract_wasm(Bytes::from_array(&env, &MINIMAL_CONTRACT_WASM));

    env.mock_all_auths();
    client.upgrade(&new_wasm_hash);

    assert_eq!(
        env.auths(),
        std::vec![(
            admin,
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id,
                    Symbol::new(&env, "upgrade"),
                    (new_wasm_hash,).into_val(&env),
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
}

#[test]
fn upgrade_rejects_non_admin() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let contract_id = env.register(Groth16Verifier {}, (admin,));
    let client = Groth16VerifierClient::new(&env, &contract_id);
    let new_wasm_hash = env
        .deployer()
        .upload_contract_wasm(Bytes::from_array(&env, &MINIMAL_CONTRACT_WASM));

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "upgrade",
            args: (new_wasm_hash.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_upgrade(&new_wasm_hash).is_err());
}

#[test]
fn upgrade_rejects_unsigned_call() {
    let env = Env::default();
    let client = create_client(&env);
    let new_wasm_hash = env
        .deployer()
        .upload_contract_wasm(Bytes::from_array(&env, &MINIMAL_CONTRACT_WASM));

    assert!(client.try_upgrade(&new_wasm_hash).is_err());
}

#[test]
fn admin_and_upgrade_return_admin_not_set_without_an_admin() {
    let env = Env::default();
    let contract_id = env.register(Groth16Verifier {}, (Address::generate(&env),));
    let client = Groth16VerifierClient::new(&env, &contract_id);
    env.as_contract(&contract_id, || {
        env.storage().instance().remove(&DataKey::Admin)
    });
    let new_wasm_hash = env
        .deployer()
        .upload_contract_wasm(Bytes::from_array(&env, &MINIMAL_CONTRACT_WASM));

    env.mock_all_auths();
    assert_eq!(client.try_admin(), Err(Ok(Groth16Error::AdminNotSet)));
    assert_eq!(
        client.try_upgrade(&new_wasm_hash),
        Err(Ok(Groth16Error::AdminNotSet))
    );
}

#[test]
fn test() {
    let env = Env::default();

    let alphax = "851850525556173310373115880154698084608631105506432893865500290442025919078535925294035153152030470398262539759609";
    let alphay = "2637289349983507610125993281171282870664683328789064436670091381805667870657250691837988574635646688089951719927247";

    let betax1 = "1312620381151154625549413690218290437739613987001512553647554932245743783919690104921577716179019375920325686841943";
    let betax2 = "1853421227732662200477195678252233549930451033531229987959164216695698667330234953033341200627605777603511819497457";
    let betay1 = "3215807833988244618006117550809420301978856703407297742347804415291049013404133666905173282837707341742014140541018";
    let betay2 = "812366606879346135498483310623227330050424196838294715759414425317592599094348477520229174120664109186562798527696";

    let gammax1 = "352701069587466618187139116011060144890029952792775240219908644239793785735715026873347600343865175952761926303160";
    let gammax2 = "3059144344244213709971259814753781636986470325476647558659373206291635324768958432433509563104347017837885763365758";
    let gammay1 = "1985150602287291935568054521177171638300868978215655730859378665066344726373823718423869104263333984641494340347905";
    let gammay2 = "927553665492332455747201965776037880757740193453592970025027978793976877002675564980949289727957565575433344219582";

    let deltax1 = "2981843938988033214458466658185878126396080429969635248100956025957789319926032198626745120548947333202362392267114";
    let deltax2 = "2236695112259305382987038341098587500598216646308901956168137697892380899086228863246537938263638056666003066263342";
    let deltay1 = "717163810166643254871951856655865822196000925757284470845197358532703820821048809982340614428800986999944933231635";
    let deltay2 = "3496058064578305387608803828034117220735807855182872031001942587835768203820179263722136810383631418598310938506798";

    let ic0x = "829685638389803071404995253486571779300247099942205634643821309129201420207693030476756893332812706176564514055395";
    let ic0y = "3455508165409829148751617737772894557887792278044850553785496869183933597103951941805834639972489587640583544390358";

    let ic1x = "2645559270376031734407122278942646687260452979296081924477586893972449945444985371392950465676350735694002713633589";
    let ic1y = "2241039659097418315097403108596818813895651201896886552939297756980670248638746432560267634304593609165964274111037";

    let vk = VerificationKey {
        alpha: g1_from_coords(&env, alphax, alphay),
        beta: g2_from_coords(&env, betax1, betax2, betay1, betay2),
        gamma: g2_from_coords(&env, gammax1, gammax2, gammay1, gammay2),
        delta: g2_from_coords(&env, deltax1, deltax2, deltay1, deltay2),
        ic: Vec::from_array(
            &env,
            [
                g1_from_coords(&env, ic0x, ic0y),
                g1_from_coords(&env, ic1x, ic1y),
            ],
        ),
    };

    let pi_ax = "314442236668110257304682488877371582255161413673331360366570443799415414639292047869143313601702131653514009114222";
    let pi_ay = "2384632327855835824635705027009217874826122107057894594162233214798350178691568018290025994699762298534539543934607";
    let pi_bx1 = "428844167033934720609657613212495751617651348480870890908850335525890280786532876634895457032623422366474694342656";
    let pi_bx2 = "3083139526360252775789959298805261067575555607578161553873977966165446991459924053189383038704105379290158793353905";
    let pi_by1 = "1590919422794657666432683000821892403620510405626533455397042191265963587891653562867091397248216891852168698286910";
    let pi_by2 = "3617931039814164588401589536353142503544155307022467123698224064329647390280346725086550997337076315487486714327146";
    let pi_cx = "3052934797502613468327963344215392478880720823583493172692775426011388142569325036386650708808320216973179639719187";
    let pi_cy = "2028185281516938724429867827057869371578022471499780916652824405212207527699373814371051328341613972789943854539597";

    let proof = Proof {
        a: g1_from_coords(&env, pi_ax, pi_ay),
        b: g2_from_coords(&env, pi_bx1, pi_bx2, pi_by1, pi_by2),
        c: g1_from_coords(&env, pi_cx, pi_cy),
    };

    let client = create_client(&env);

    let output = Vec::from_array(&env, [Fr::from_u256(U256::from_u32(&env, 33))]);
    let res = client.verify_proof(&vk, &proof, &output);
    assert!(res);

    let bad_output = Vec::from_array(&env, [Fr::from_u256(U256::from_u32(&env, 22))]);
    let res = client.verify_proof(&vk, &proof, &bad_output);
    assert!(!res);
}

// ---------------------------------------------------------------------------
// Anonymous Goat: election lifecycle
// ---------------------------------------------------------------------------

/// `0x`-prefixed 32-byte hex -> `BytesN<32>`, the encoding the CLI sends.
fn bytes32(env: &Env, hex: &str) -> BytesN<32> {
    let clean = hex.strip_prefix("0x").unwrap_or(hex);
    let mut array = [0u8; 32];
    for (i, byte) in array.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&clean[i * 2..i * 2 + 2], 16).unwrap();
    }
    BytesN::from_array(env, &array)
}

/// The proof generated by `ctg zk prove main` for the demo input.
fn sample_proof(env: &Env) -> Proof {
    Proof {
        a: g1_from_coords(env, tv::PROOF_A_X, tv::PROOF_A_Y),
        b: g2_from_coords(
            env,
            tv::PROOF_B_X0,
            tv::PROOF_B_X1,
            tv::PROOF_B_Y0,
            tv::PROOF_B_Y1,
        ),
        c: g1_from_coords(env, tv::PROOF_C_X, tv::PROOF_C_Y),
    }
}

fn sample_inputs(env: &Env) -> PublicInputs {
    PublicInputs {
        merkle_root: bytes32(env, tv::MERKLE_ROOT_HEX),
        election_id: bytes32(env, tv::ELECTION_ID_HEX),
        nullifier: bytes32(env, tv::NULLIFIER_HEX),
        vote: tv::VOTE,
    }
}

fn tally_after_one_vote() -> Tally {
    if tv::VOTE == 0 {
        Tally { gta6: 1, zelda: 0 }
    } else {
        Tally { gta6: 0, zelda: 1 }
    }
}

/// Deploys the contract and freezes it with the demo election parameters.
fn initialized_client(env: &Env) -> (Groth16VerifierClient<'_>, Address, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register(Groth16Verifier {}, (admin.clone(),));
    let client = Groth16VerifierClient::new(env, &contract_id);
    env.mock_all_auths();
    client.initialize(
        &admin,
        &bytes32(env, tv::MERKLE_ROOT_HEX),
        &bytes32(env, tv::ELECTION_ID_HEX),
    );
    (client, admin, contract_id)
}

#[test]
fn initialize_freezes_the_election_and_tally_starts_at_zero() {
    let env = Env::default();
    let (client, _, _) = initialized_client(&env);

    assert_eq!(client.get_tally(), Tally { gta6: 0, zelda: 0 });
}

#[test]
fn initialize_rejects_a_different_admin() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(Groth16Verifier {}, (admin,));
    let client = Groth16VerifierClient::new(&env, &contract_id);
    let attacker = Address::generate(&env);

    env.mock_all_auths();
    assert_eq!(
        client.try_initialize(
            &attacker,
            &bytes32(&env, tv::MERKLE_ROOT_HEX),
            &bytes32(&env, tv::ELECTION_ID_HEX),
        ),
        Err(Ok(Groth16Error::Unauthorized))
    );
    assert_eq!(
        client.try_get_tally(),
        Err(Ok(Groth16Error::NotInitialized))
    );
}

#[test]
fn initialize_is_one_shot() {
    let env = Env::default();
    let (client, admin, _) = initialized_client(&env);

    env.mock_all_auths();
    assert_eq!(
        client.try_initialize(
            &admin,
            &bytes32(&env, tv::MERKLE_ROOT_HEX),
            &bytes32(&env, tv::ELECTION_ID_HEX),
        ),
        Err(Ok(Groth16Error::AlreadyInitialized))
    );
}

#[test]
fn vote_requires_an_initialized_election() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(Groth16Verifier {}, (admin,));
    let client = Groth16VerifierClient::new(&env, &contract_id);

    assert_eq!(
        client.try_vote(&sample_proof(&env), &sample_inputs(&env)),
        Err(Ok(Groth16Error::NotInitialized))
    );
    assert_eq!(
        client.try_get_tally(),
        Err(Ok(Groth16Error::NotInitialized))
    );
}

#[test]
fn vote_accepts_a_valid_proof_and_counts_the_ballot() {
    let env = Env::default();
    let (client, _, _) = initialized_client(&env);

    client.vote(&sample_proof(&env), &sample_inputs(&env));

    assert_eq!(client.get_tally(), tally_after_one_vote());
}

#[test]
fn vote_publishes_a_vote_cast_event() {
    let env = Env::default();
    let (client, _, contract_id) = initialized_client(&env);
    let inputs = sample_inputs(&env);

    client.vote(&sample_proof(&env), &inputs);

    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                contract_id,
                vec![
                    &env,
                    symbol_short!("VoteCast").into_val(&env),
                    inputs.nullifier.into_val(&env),
                ],
                inputs.vote.into_val(&env),
            )
        ]
    );
}

#[test]
fn vote_rejects_a_reused_nullifier() {
    let env = Env::default();
    let (client, _, _) = initialized_client(&env);

    client.vote(&sample_proof(&env), &sample_inputs(&env));
    let tally_after_first = client.get_tally();

    assert_eq!(
        client.try_vote(&sample_proof(&env), &sample_inputs(&env)),
        Err(Ok(Groth16Error::NullifierAlreadyUsed))
    );
    assert_eq!(client.get_tally(), tally_after_first);
}

#[test]
fn vote_rejects_a_proof_bound_to_another_election() {
    let env = Env::default();
    let (client, _, _) = initialized_client(&env);
    let other = "0x0000000000000000000000000000000000000000000000000000000000000001";

    let mut wrong_root = sample_inputs(&env);
    wrong_root.merkle_root = bytes32(&env, other);
    assert_eq!(
        client.try_vote(&sample_proof(&env), &wrong_root),
        Err(Ok(Groth16Error::RootMismatch))
    );

    let mut wrong_election = sample_inputs(&env);
    wrong_election.election_id = bytes32(&env, other);
    assert_eq!(
        client.try_vote(&sample_proof(&env), &wrong_election),
        Err(Ok(Groth16Error::ElectionMismatch))
    );

    assert_eq!(client.get_tally(), Tally { gta6: 0, zelda: 0 });
}

#[test]
fn vote_rejects_a_tampered_ballot() {
    let env = Env::default();
    let (client, _, _) = initialized_client(&env);

    // The proof was produced for `tv::VOTE`; flipping the public signal breaks
    // the pairing check.
    let mut tampered = sample_inputs(&env);
    tampered.vote = if tv::VOTE == 0 { 1 } else { 0 };
    assert_eq!(
        client.try_vote(&sample_proof(&env), &tampered),
        Err(Ok(Groth16Error::InvalidProof))
    );

    // A ballot outside {0, 1} never reaches the pairing check.
    let mut non_binary = sample_inputs(&env);
    non_binary.vote = 2;
    assert_eq!(
        client.try_vote(&sample_proof(&env), &non_binary),
        Err(Ok(Groth16Error::InvalidVote))
    );

    assert_eq!(client.get_tally(), Tally { gta6: 0, zelda: 0 });
}

#[test]
fn increment_tally_counts_both_options() {
    let mut tally = Tally { gta6: 0, zelda: 0 };
    crate::increment_tally(&mut tally, 0);
    crate::increment_tally(&mut tally, 1);
    crate::increment_tally(&mut tally, 1);
    assert_eq!(tally, Tally { gta6: 1, zelda: 2 });
}
