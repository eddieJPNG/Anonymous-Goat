# Anonymous Goat

dApp de votação **anônima** na Stellar (Soroban) para eleger o "Melhor Jogo de 2026":

| Candidato | `vote` |
|---|---|
| *Grand Theft Auto 6* | `0` |
| *The Legend of Zelda: Ocarina of Time Remake* | `1` |

O eleitor prova, com uma prova de conhecimento zero (Groth16 sobre BLS12-381), que pertence a
uma lista pré-aprovada (Merkle tree de profundidade 4) e que ainda não votou — **sem revelar qual
identidade da lista controla**. O contrato Soroban verifica a prova on-chain, consome um
*nullifier* (um por `(secret, electionId)`, logo sem voto duplo) e atualiza o placar público.

> **Status:** Sprints 1–3 concluídas — circuito compilado, contrato na testnet aceitando
> provas e frontend E2E (conectar carteira → provar no navegador → votar → placar
> atualizado). Suíte E2E (Sprint 4) e documentação/demo final (Sprint 5) ainda pendentes.
> Escopo congelado em [`Documents/SSD.md`](Documents/SSD.md), plano em
> [`Documents/PLAN.MD`](Documents/PLAN.MD).

## Requisitos

- Protocol 27+ na rede alvo (o verificador usa `soroban-sdk` 27.0.6)
- Rust `1.91.1` + target `wasm32v1-none`
- Stellar CLI (testado com 30.0.1) e Node 20+
- Identidade de testnet fundada, ex.: `stellar keys generate alice --network testnet --fund`

## Arquitetura

```
circuits/anonymous_goat.circom   # commitment, inclusão Merkle, nullifier, voto binário
circuits/main.circom             # entry: AnonymousGoat(4), public [merkleRoot, electionId, vote]
scripts/lib/poseidon.mjs         # Poseidon portado para BLS12-381 Fr (validado no witness)
scripts/lib/merkle.mjs           # árvore de profundidade 4
scripts/generate-input.mjs       # árvore demo determinística → circuits/input.json
scripts/gen-demo-tree.mjs        # mesma árvore → circuits/demo-tree.json (para o browser)
contracts/verifier/src/lib.rs    # initialize / vote / get_tally
src/App.tsx                      # tela: placar, seletor de eleitor, cards GTA 6 / Zelda
src/zk/prove.ts                  # input.json + snarkjs.groth16.fullProve no navegador
src/zk/serialize.ts              # prova/snarkjs → struct `Proof`/`PublicInputs` do contrato
src/vote.ts                      # castVote/fetchTally + mapeamento dos erros #0–#9
```

### Circuito

- `commitment = Poseidon(secret)` — a folha do eleitor na árvore de elegíveis
- inclusão Merkle com `pathIndices` booleanos (troca esquerda/direita por nível)
- `nullifier = Poseidon(secret, electionId)` — saída do circuito, logo público
- `vote * (vote - 1) === 0` — voto binário
- **1426 restrições não-lineares**, 3 entradas públicas, 1 saída pública, 9 entradas privadas

A ordem real dos *public signals* (snarkjs coloca saídas antes, depois os inputs públicos na
ordem do `{public [...]}`) é:

```
[nullifier, merkleRoot, electionId, vote]
```

O contrato monta o `Vec<Fr>` nessa ordem exata — ver
[`docs/CAATINGA_FRICTION_LOG.md`](docs/CAATINGA_FRICTION_LOG.md) (F9).

### Contrato

| Função | Papel |
|---|---|
| `__constructor(admin)` | grava o admin (Caatinga passa `deployArgs.admin`) |
| `initialize(admin, merkleRoot, electionId)` | congela a eleição; só o admin do construtor, uma vez |
| `vote(proof, publicInputs)` | valida root/electionId → verifica Groth16 → nullifier → placar → evento `VoteCast` |
| `get_tally()` | retorna `{ gta6, zelda }` (erro antes do `initialize`) |
| `admin()` / `upgrade(wasmHash)` | manutenção do verificador |

Storage: `Admin`, `MerkleRoot`, `ElectionId`, `Nullifiers` (mapa nullifier → usado),
`Tally`. Nada é escrito antes de todas as validações passarem.

Erros (`Groth16Error`): `AlreadyInitialized=2`, `NotInitialized=3`, `Unauthorized=4`,
`RootMismatch=5`, `ElectionMismatch=6`, `InvalidVote=7`, `InvalidProof=8`,
`NullifierAlreadyUsed=9`.

## Comandos

```bash
npm install

# Circuito (Sprint 1)
node scripts/generate-input.mjs          # regenera circuits/input.json (árvore demo)
npx ctg zk build main                    # compila + dev ceremony (testnet only)
npx ctg zk prove main                    # → .artifacts/zk/main/{proof,public}.json

# Contrato (Sprint 2)
export PATH="$HOME/.cargo/bin:$PATH"
cargo fmt --manifest-path contracts/verifier/Cargo.toml
cargo clippy --manifest-path contracts/verifier/Cargo.toml --all-targets
cargo test   --manifest-path contracts/verifier/Cargo.toml     # 16 testes

npx ctg zk build main --embed-vk         # grava a VK real em src/vk.rs (muda as chaves!)
npx ctg zk prove main                    # re-prova contra a VK recém-gerada
node scripts/gen-test-vectors.mjs        # regrava src/test_vectors.rs
cargo test --manifest-path contracts/verifier/Cargo.toml

npx ctg build verifier                   # → contracts/verifier/target/wasm32v1-none/release/verifier.wasm
npx ctg deploy verifier --network testnet --source alice
```

> O `ctg zk build` roda uma **dev ceremony** local e regenera as chaves **a cada build**.
> Depois de qualquer `zk build`, refaça `prove` (+ `gen-test-vectors`) antes de invocar ou testar.

### Smoke test na testnet

```bash
node scripts/generate-input.mjs --root    # imprime merkleRoot e electionId

stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- initialize \
  --admin <PUBLIC_KEY_ALICE> \
  --merkle-root <64 hex sem 0x> \
  --election-id <64 hex sem 0x>

stellar contract invoke --send=no --id <CONTRACT_ID> --source alice --network testnet -- get_tally

node scripts/serialize-proof.mjs          # gera --proof / --public-inputs em JSON
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- vote \
  --proof '<json>' --public-inputs '<json>'
```

Argumentos `BytesN` chegam na CLI como **hex sem prefixo `0x`** (F10 no friction log).

## Frontend (Sprint 3)

```bash
node scripts/gen-demo-tree.mjs   # regenera circuits/demo-tree.json (raiz/electionId fixos)
npm run dev                      # → http://localhost:5173
```

Fluxo na tela:

1. **Connect** abre o modal de carteiras (Freighter via `@creit.tech/stellar-wallets-kit`).
2. Escolha o eleitor demo e o jogo (dois cards: GTA 6 = `0`, Zelda = `1`).
3. A prova Groth16 é gerada **no navegador** com `snarkjs` — o Vite serve
   `main.wasm` (`application/wasm`) e `circuit_final.zkey` (`application/octet-stream`)
   em `/zk-artifacts/…` (bytes intactos; ver F16).
4. O `input.json` é montado a partir do `secret` e do caminho Merkle de
   `circuits/demo-tree.json`; a prova é assinada/invocada via cliente Caatinga.
5. Em sucesso o placar é relido de `get_tally`; falhas exibem erro claro
   (prova inválida `#8`, voto duplo `#9`, root/electionId divergentes `#5`/`#6`).

Notas:

- A árvore demo tem **4 eleitores** (folhas restantes = 0); segredos são valores
  derivados de uma seed fixa — **somente demo**, nunca use em produção.
- Medido em Chromium headless: prova completa no navegador em **~1 s** (árvore
  pequena, profundidade 4). Se o navegador do usuário não suportar WASM/WebAssembly
  threads, o fallback é gerar a prova com `npx ctg zk prove main` e submeter pelo
  frontend apenas a transação (mesmo contrato, mesma serialização).
- Os eleitores 0 e 2 já votaram no contrato implantado; o seletor começa em **1**
  (votos `0` e `3` ainda disponíveis).

## Contrato implantado (testnet)

| Item | Valor |
|---|---|
| Contract ID | `CDOJDVSWEFLITASNS75BWGCQFTCNE5S7E44EFLWPQEAFZELKPUOLOUC5` |
| Rede | Stellar Testnet |
| Admin | `GAG365PPS55CZWFL6KPAJFZO2VRMMEUKOVOI7YNMNKWIGKLXTFDA67OF` (`alice`) |
| `merkleRoot` | `02ae654d64e8854e6a56f2da280bd14bd3a8ff00240094dbfc9353956d6a5f45` |
| `electionId` | `0c5def8ce477d4bbdf7c2dc827dda193a105aab05f210c923df34abe7bebd271` |
| tx `initialize` | `61877991b5946dcc6f34d2ab97bd228d57ce914b97f4ed94e9007ba01f68778a` |
| tx `vote` (GTA 6) | `1bf8fa565e97696633b8240f43d0b8e7e3219ac4205f647e9b9a8ee09915c341` |
| tx `vote` (Zelda, XDR do browser) | `198e14747fce3f9347caea52d6909011f6edc395fa6784aee2c70de87b4f5c50` |

Resultado observado: `get_tally` → `{"gta6":2,"zelda":0}`; repetir o mesmo voto falha com
`Error(Contract, #9)` (`NullifierAlreadyUsed`) e uma prova com nullifier alterado falha
com `Error(Contract, #8)` (`InvalidProof`). A tx `198e14…` foi **montada no navegador**
(`buildXdr` do cliente Caatinga), assinada e enviada — o caminho exato do frontend.

## Testes

```bash
cargo test --manifest-path contracts/verifier/Cargo.toml
```

Cobrem: prova válida aceita, prova inválida rejeitada, voto duplo rejeitado, root/electionId
divergentes rejeitados, voto não-binário rejeitado, `initialize` uma única vez e só pelo admin,
evento `VoteCast`, e o acumulador dos dois candidatos.

## Trusted setup

O `ctg zk build` roda um trusted setup **local, single-party**, adequado apenas ao
desenvolvimento. Não use essas chaves em produção: rode uma cerimônia MPC real e importe com
`ctg import-ceremony`.

O Caatinga bloqueia `zk build` e deploy/invoke em `mainnet` com artefatos de dev ceremony, a
menos que se use `--allow-dev-ceremony` conscientemente. Veja
[ZK production guardrails](https://github.com/Dione-b/caatinga/blob/main/docs/zk.md#production-guardrails).

## Limitações conhecidas

- Anonimato depende do tamanho do conjunto: Merkle depth 4 = até 16 elegíveis.
- Quem paga a taxa da transação é público; o anonimato é sobre a identidade na lista.
- O voto é público on-chain; o anonimato é do eleitor, não da escolha.
- A dev ceremony não é segura para produção.

## Referências

- Friction log do Caatinga: [`docs/CAATINGA_FRICTION_LOG.md`](docs/CAATINGA_FRICTION_LOG.md)
- Modelo de ameaças: `docs/THREAT_MODEL.md` (pendente — Sprint 5)
