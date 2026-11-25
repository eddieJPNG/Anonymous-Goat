# Modelo de Ameaças — Anonymous Goat

Complementa o [README](../README.md) e detalha a Seção 9 do
[`Documents/SSD.md`](../Documents/SSD.md) com referência direta à implementação.
Escopo: votação binária (GTA 6 = `0`, Zelda = `1`), Merkle depth 4, Poseidon,
Groth16 sobre BLS12-381, contrato Soroban na **Stellar Testnet**.

---

## 1. Ativos

| Ativo | Onde vive | Consequência se comprometido |
|---|---|---|
| `secret` de cada eleitor | off-chain (distribuído ao eleitor) | permite gerar provas por ele — voto roubado/nullifier gasto |
| Raiz Merkle da eleição | contrato (`MerkleRoot`), definida no `initialize` | eleitores falsos ou elegíveis reais excluídos |
| Integridade do placar | contrato (`Tally`), leitura `get_tally` | resultado da eleição forjado |
| Conjunto de nullifiers | contrato (`Nullifiers`) | voto duplo aceito |
| Chaves do trusted setup (`.artifacts/zk`) | dev ceremony local | prova forjada sem `secret` |

## 2. Modelo de confiança

**Confiável (para este escopo):**

- A **circuit constraints** e o **verificador Groth16** — corretos se o
  circuito/`vk.rs` forem os auditados (`npm test` regenera e confere).
- O **admin** da eleição — define a raiz Merkle e faz `upgrade` do verificador
  (aceito em testnet; ver §5).
- A **SDF testnet** (RPC + friendbot) — infraestrutura de teste; indisponibilidade
  não é ataque (a UI distingue "conta não financiada" de "RPC fora" — F24).

**Não confiável:**

- Outros eleitores, qualquer observador on-chain, a rede pública.
- Um **frontend/RPC de leitura comprometido** — pode exibir um placar falso;
  o dado canônico é o do contrato (verificação independente em §6).
- A **dev ceremony** — single-party, local; aceitável **apenas em testnet**
  (guardrails do Caatinga bloqueiam `mainnet` sem `--allow-dev-ceremony`).

## 3. Garantias (SSD §9.1 + onde são impostas)

| Garantia | Mecanismo | Imposição |
|---|---|---|
| **Elegibilidade** | `commitment = Poseidon(secret)` é folha da árvore; prova só valida se o caminho harmoniza com a raiz pública | circuito (`circuits/anonymous_goat.circom`) + raiz fixada no contrato (`#5` se divergir) |
| **Voto único** | `nullifier = Poseidon(secret, electionId)` — determinístico, um por eleitor por eleição | contrato: mapa `Nullifiers`, reverta com `#9` (`NullifierAlreadyUsed`) |
| **Integridade do voto** | a prova vincula `vote` (binário), nullifier e elegibilidade no mesmo testemunho | restrição `vote*(vote-1)=0` no circuito + verificação Groth16 on-chain (`#8` em caso de falha) |
| **Transparência** | placar, nullifiers usados e evento `VoteCast` são públicos | `get_tally`, mapa `Nullifiers` legível via RPC; auditável por qualquer um |

Ordem exata dos *public signals* que o contrato espera:
`[nullifier, merkleRoot, electionId, vote]` (F9 no friction log).

## 4. Ameaças e mitigações

| # | Ameaça | Mitigação | Evidência |
|---|---|---|---|
| T1 | Prova inválida (sem `secret` na árvore, ou adulterada) | verificador Groth16 rejeita | erro `#8` (`InvalidProof`); `npm test` + teste 2 de `npm run test:e2e` ([log](E2E_TEST_LOG.txt)) |
| T2 | Voto duplo (mesmo eleitor duas vezes) | nullifier único por `(secret, electionId)`; o contrato só grava após todas as validações | erro `#9` (`NullifierAlreadyUsed`); `npm test` + teste 3 do e2e |
| T3 | Uso do `secret` de outra pessoa | `secret` nunca sai do eleitor; sem ele não há prova — a árvore só contém commitments | segredos distribuídos off-chain; nada de `secret` no repositório (guard de strkey no `scripts/test.sh`, F21) |
| T4 | *Front-running* / tentativa de votar no lugar da vítima vendo a mempool | o atacante vê a transação, mas não o `secret`; sem ele não produz prova alguma, e o nullifier da vítima fica consumado — não há "voto em branco" para sequestrar | prova imutável dentro da tx; ver T2 |
| T5 | Voto não-binário (`vote = 2`, `-1`…) | `vote*(vote-1) === 0` no circuito + `#7` (`InvalidVote`) no contrato | `npm test` (voto não-binário) |
| T6 | Raiz/`electionId` adulterados na chamada | o contrato compara com os valores congelados no `initialize` | erros `#5` (`RootMismatch`) / `#6` (`ElectionMismatch`); `npm test` |
| T7 | Admin malicioso inclui eleitores falsos | `initialize` one-shot e restrito ao admin; raiz é pública e auditável | `#2`/`#4`; aceito em testnet (§5) |
| T8 | `upgrade` malicioso do verificador | só o admin pode chamar `upgrade(wasmHash)` | `Unauthorized` = `#4` |
| T9 | Reaproveitamento de proof/public inputs entre eleições | `electionId` participa do nullifier e é verificado na prova | `#5`/`#6` + restrição do circuito |
| T10 | Comprometimento da dev ceremony | Caatinga bloqueia artefatos de dev ceremony em `mainnet` | guardrails do Caatinga; §5 |
| T11 | Placar falso via frontend/RPC de leitura | dado canônico é o contrato; leitura via `get_tally` e verificação CLI independente | §6 |
| T12 | Conta do eleitor sem fundos (indisponibilidade, não ataque) | aviso "Fund testnet account" + leitura do placar com fonte fixa | F24/F25; `<FundNotice/>` |

## 5. Limitações (SSD §9.2)

1. **Anonimato depende do tamanho do conjunto** — Merkle depth 4 = **até 16
   elegíveis**; com poucos eleitores, a anonimidade é estatisticamente fraca.
   O conjunto de 4 da demo é para testnet, não para eleição real.
2. **O pagante é público** — a tx é assinada pela carteira do eleitor, então o
   endereço que paga a taxa é visível. Ele **não** é vinculado ao commitment na
   lista: o anonimato é sobre a *identidade na lista*, não sobre a carteira.
3. **O voto é público** — escolha (GTA 6/Zelda) visível on-chain; o que se
   preserva é o vínculo eleitor→voto, não o conteúdo do voto. Padrão de
   votações anônimas.
4. **Confiança no admin** — quem define a raiz Merkle pode incluir eleitores
   falsos ou excluir reais. Aceitável no escopo testnet do bounty.
5. **Trusted setup local (dev ceremony)** — single-party; não seguro para
   produção (rever §"Trusted setup" do README; ceremony real via
   `ctg import-ceremony`).
6. **Testnet only** — contrato implantado na Stellar Testnet; friendbot e
   contas de teste têm valor simbólico.
7. **Frontend/RPC de leitura** — um frontend hospedado malicioso pode exibir
   um placar falso; isolar isso exige verificação independente (§6) ou
   frontend servido de forma confiável.

## 6. Verificação independente

Qualquer observador pode checar o estado sem confiar no frontend:

```bash
# placar real on-chain
stellar contract invoke --send=no --id <CONTRACT_ID> --source alice --network testnet -- get_tally

# suíte de rejeição (prova inválida #8, voto duplo #9)
npm run test:e2e
```

Os testes unitários do contrato (`npm test`, 16 testes) cobrem: prova válida,
prova inválida, voto duplo, root/`electionId` divergentes, voto não-binário,
`initialize` (one-shot + admin), evento `VoteCast` e o acumulador do placar.

## 7. Fora de escopo

- Distribuição segura de `secret` aos eleitores (canal off-chain assumido).
- Sybil na criação da lista de elegíveis — o admin *é* a autoridade.
- Privacidade do conteúdo do voto (limitação 3).
- Produção/mainnet (limitações 4–6).
