Com base na documentação oficial do Caatinga e nos requisitos do bounty, a sua ideia está bem alinhada com o que é esperado. O ponto central é transformar a "elegibilidade" em um compromisso criptográfico (um \*commitment\*) e usar um \*nullifier\* para impedir o voto duplo, sem que o contrato Soroban precise saber quem é o eleitor.


Abaixo segue o \*\*System Design Document (SDD)\*\* completo para o projeto \*\*Anonymous Goat\*\*, mantendo o escopo simples e focado no que o desafio pede.


---


\# System Design Document (SDD) — Anonymous Goat


\#\# 1. Visão Geral


\*\*Anonymous Goat\*\* é uma dApp de votação anônima na Stellar (Soroban) para eleger o "Melhor Jogo do Ano de 2026" entre dois candidatos fictícios: \*Grand Theft Auto 6\* e \*The Legend of Zelda: Ocarina of Time Remake\*.


O sistema permite que um eleitor prove, via prova de conhecimento zero (ZK), que é elegível (está em uma lista pré-aprovada) e que ainda não votou, sem revelar qual identidade da lista ele controla. O contrato Soroban verifica a prova on-chain, registra o voto de forma pública (a escolha é visível, mas não o autor) e impede o voto duplo através de um \*nullifier\*.


\*\*Stack principal:\*\*

- \*\*Circuito:\*\* Circom (Groth16) com Poseidon.

- \*\*Verificação on-chain:\*\* Contrato Soroban (Rust) gerado/adaptado via Caatinga.

- \*\*Workflow:\*\* Caatinga CLI (\`ctg zk init\`, \`ctg zk build\`, \`ctg deploy verifier\`, \`ctg zk prove\`, \`ctg zk invoke\`).

- \*\*Frontend:\*\* React + Vite (template do Caatinga), paleta branco/dourado/preto, dois cards grandes.

- \*\*Rede:\*\* Stellar Testnet (Protocolo 25+).


\#\# 2. Objetivos e Escopo


\#\#\# 2.1 Objetivo Geral

Implementar uma votação binária anônima onde a elegibilidade é provada por ZK e o resultado é auditável on-chain, sem vínculo entre a cédula e a identidade real do eleitor.


\#\#\# 2.2 Escopo Incluído

- Circuito Circom original para prova de inclusão em Merkle Tree + derivação de \*nullifier\* + voto binário.

- Contrato Soroban que verifica a prova Groth16, gerencia \*nullifiers\* usados e mantém a contagem pública dos votos.

- Frontend com dois cards (GTA 6 vs. Zelda) e conexão de carteira (Freighter) apenas para assinar a transação de voto.

- Scripts de deploy e geração de prova reprodutíveis.

- Testes automatizados demonstrando aceitação de prova válida e rejeição de prova inválida.

- Documentação do modelo de ameaças.


\#\#\# 2.3 Escopo Excluído

- Anonimato de rede (a transação é assinada pela carteira do eleitor; o anonimato é sobre a \*identidade na lista\*, não sobre o endereço que paga a taxa).

- Múltiplas eleições simultâneas (o contrato é implantado para uma eleição específica).

- Cerimônia de confiança para produção (será usada a \*dev ceremony\* do Caatinga, adequada para testnet).


\#\# 3. Requisitos


\#\#\# 3.1 Requisitos Funcionais

| ID | Descrição |

|----|-----------|

| RF-01 | O administrador implanta o contrato com a raiz de Merkle da lista de eleitores elegíveis e um \`election\_id\`. |

| RF-02 | O eleitor possui um \`secret\` (segredo) cujo \*commitment\* (\`Poseidon(secret)\`) está na árvore. |

| RF-03 | O frontend gera uma prova ZK localmente, provando que o eleitor conhece um \`secret\` cuja folha está na raiz e que o \*nullifier\* é derivado corretamente. |

| RF-04 | O eleitor seleciona um dos dois jogos (voto \`0\` ou \`1\`) e envia a prova + voto ao contrato. |

| RF-05 | O contrato verifica a prova Groth16, rejeita se o \*nullifier\* já foi usado, e incrementa o placar público do jogo escolhido. |

| RF-06 | Qualquer pessoa pode consultar o placar público a qualquer momento. |

| RF-07 | O sistema deve rejeitar provas inválidas e votos duplicados. |


\#\#\# 3.2 Requisitos Não Funcionais

| ID | Descrição |

|----|-----------|

| RNF-01 | A prova deve ser gerada em menos de 5 segundos no navegador (para uma árvore de profundidade 4–8). |

| RNF-02 | O contrato deve ser implantado na Stellar Testnet e ser verificável publicamente. |

| RNF-03 | O frontend deve seguir a paleta branco, dourado e preto. |

| RNF-04 | O código deve ser reproduzível via comandos documentados no README. |


\#\# 4. Arquitetura do Sistema


\#\#\# 4.1 Componentes


1.  \*\*Circuito Circom (\`circuits/anonymous\_goat.circom\`)\*\*

    - Prova: conhecimento de \`secret\` e caminho de Merkle que levam à \`merkleRoot\` pública, derivação de \`nullifier\` e voto binário.

2.  \*\*Contrato Soroban (\`contracts/verifier/src/lib.rs\`)\*\*

    - Verificador Groth16 (gerado pelo Caatinga, com adaptações para armazenar \*nullifiers\* e placar).

3.  \*\*Scripts de Prova (\`scripts/prove.js\` ou similar)\*\*

    - Gera \`proof.json\` e \`public.json\` a partir de \`input.json\` usando \`snarkjs\`.

4.  \*\*Frontend (React + Vite)\*\*

    - Tela principal com dois cards (GTA 6 / Zelda).

    - Conexão Freighter para assinar a transação.

    - Geração de prova no cliente (via \`@caatinga/client\` ou \`snarkjs\` no browser).

5.  \*\*Caatinga CLI\*\*

    - Orquestra build, deploy e invocação on-chain.


\#\#\# 4.2 Fluxo de Trabalho (Workflow)


1.  \*\*Setup:\*\* Admin gera \`secret\` para cada eleitor, calcula commitments e constrói a Merkle Tree. A raiz é passada ao contrato no deploy.

2.  \*\*Distribuição:\*\* Cada eleitor recebe seu \`secret\` e o caminho de Merkle (fora da cadeia).

3.  \*\*Votação:\*\*

    - Eleitor conecta a carteira (Freighter) no frontend.

    - Seleciona um jogo.

    - O frontend monta o \`input.json\` (com \`secret\`, \`merklePath\`, \`vote\`).

    - Executa \`ctg zk prove\` (ou snarkjs no browser) → \`proof.json\` e \`public.json\`.

    - Chama \`ctg zk invoke\` (ou o contrato diretamente via cliente Caatinga) passando \`proof\` e \`publicInputs\`.

    - O contrato verifica, consome o \*nullifier\* e atualiza o placar.

4.  \*\*Consulta:\*\* Placar visível na UI.


\#\# 5. Design do Circuito ZK


\#\#\# 5.1 Declaração da Prova

O circuito prova a seguinte declaração:


\> "Eu conheço um \`secret\` tal que \`Poseidon(secret)\` é uma folha da Merkle Tree com raiz \`merkleRoot\`, e o \`nullifier\` é \`Poseidon(secret, electionId)\`."


Além disso, o voto (\`vote\`) é binário (0 ou 1) e é passado como entrada pública.


\#\#\# 5.2 Entradas e Saídas


| Tipo | Sinal | Descrição |

|------|-------|-----------|

| \*\*Privado\*\* | \`secret\` | Segredo único do eleitor (distribuído off-chain). |

| \*\*Privado\*\* | \`merklePath\[\]\` | Caminho de Merkle (irmãos). |

| \*\*Privado\*\* | \`merkleIndices\[\]\` | Índices (0/1) indicando se o nó é esquerdo ou direito. |

| \*\*Público\*\* | \`merkleRoot\` | Raiz da árvore de elegíveis (armazenada no contrato). |

| \*\*Público\*\* | \`electionId\` | Identificador da eleição (domínio do \*nullifier\*). |

| \*\*Público\*\* | \`nullifier\` | \`Poseidon(secret, electionId)\` — calculado dentro do circuito. |

| \*\*Público\*\* | \`vote\` | 0 (GTA 6) ou 1 (Zelda). |


\#\#\# 5.3 Restrições (R1CS)


1.  \`commitment = Poseidon(secret)\`

2.  Verificar inclusão de \`commitment\` na \`merkleRoot\` usando \`merklePath\` e \`merkleIndices\`.

3.  \`nullifier === Poseidon(secret, electionId)\`

4.  \`vote \* (vote - 1) === 0\` (garante binário).


\#\#\# 5.4 Escolha de Hash

Poseidon é usado por ser eficiente em circuitos ZK e compatível com BLS12-381 (padrão do Caatinga). A árvore de Merkle terá profundidade fixa (ex.: 4 níveis, permitindo até 16 eleitores), o que mantém o circuito simples e o proof pequeno.


\#\# 6. Contrato Soroban (Verificador)


\#\#\# 6.1 Interface Pública


\`\`\`rust

pub fn initialize(env: Env, admin: Address, merkle\_root: BytesN\<32\>, election\_id: BytesN\<32\>);

pub fn vote(env: Env, proof: Proof, public\_inputs: PublicInputs);

pub fn get\_tally(env: Env) -\> (u32, u32); // (gta6\_votes, zelda\_votes)

\`\`\`


\`PublicInputs\` contém \`merkle\_root\`, \`election\_id\`, \`nullifier\` e \`vote\`.


\#\#\# 6.2 Armazenamento


| Chave | Tipo | Descrição |

|-------|------|-----------|

| \`Admin\` | \`Address\` | Endereço do administrador. |

| \`MerkleRoot\` | \`BytesN\<32\>\` | Raiz da árvore de elegíveis. |

| \`ElectionId\` | \`BytesN\<32\>\` | Identificador da eleição. |

| \`Nullifiers\` | \`Map\<BytesN\<32\>, bool\>\` | \*Nullifiers\* já usados (previne voto duplo). |

| \`Tally\` | \`(u32, u32)\` | Contagem de votos para GTA 6 e Zelda. |


\#\#\# 6.3 Lógica de \`vote\`


1.  Verificar que \`public\_inputs.merkle\_root == MerkleRoot\` armazenado.

2.  Verificar que \`public\_inputs.election\_id == ElectionId\`.

3.  Verificar a prova Groth16 usando a chave de verificação embutida no contrato.

4.  Verificar que \`public\_inputs.nullifier\` \*\*não\*\* está em \`Nullifiers\`.

5.  Inserir \`nullifier\` em \`Nullifiers\`.

6.  Se \`vote == 0\`, incrementar \`tally.0\`; senão, incrementar \`tally.1\`.

7.  Emitir evento \`VoteCast(nullifier, vote)\`.


\#\# 7. Frontend


\#\#\# 7.1 Telas

- \*\*Tela Principal:\*\* Dois cards lado a lado.

    - Card GTA 6: imagem (placeholder), título, botão "Votar".

    - Card Zelda: imagem (placeholder), título, botão "Votar".

- \*\*Conexão de Carteira:\*\* Botão "Connect Wallet" (Freighter). O endereço é usado apenas para assinar a transação; não é armazenado no contrato.

- \*\*Feedback:\*\* Após o voto, exibir "Voto computado com sucesso" e o placar atualizado.


\#\#\# 7.2 Paleta de Cores

- \*\*Fundo:\*\* \`\#FFFFFF\` (branco).

- \*\*Cards:\*\* \`\#000000\` (preto) com bordas douradas (\`\#D4AF37\`).

- \*\*Texto principal:\*\* \`\#000000\` ou \`\#FFFFFF\` (dependendo do contraste).

- \*\*Botões:\*\* Fundo dourado (\`\#D4AF37\`), texto preto.

- \*\*Destaques:\*\* Linhas e ícones em dourado.


\#\#\# 7.3 Integração com Carteira

- Usar \`@caatinga/client\` para conectar à Freighter e invocar o contrato.

- A prova é gerada no navegador (via \`snarkjs\` ou \`@caatinga/client\`) antes da chamada \`vote\`.


\#\# 8. Workflow Caatinga


O projeto será inicializado com o template ZK do Caatinga:


\`\`\`bash

npx ctg zk init anonymous-goat

cd anonymous-goat

npm install

\`\`\`


Substituiremos o circuito padrão pelo \`anonymous\_goat.circom\` e adaptaremos o contrato verificador.


Comandos principais:

- \`npx ctg build verifier\` — compila o contrato.

- \`npx ctg zk build main\` — compila o circuito e roda a \*dev ceremony\*.

- \`npx ctg deploy verifier --network testnet --source alice\` — deploy na testnet.

- \`npx ctg zk prove main\` — gera prova a partir de \`input.json\`.

- \`npx ctg zk invoke main --network testnet --source alice\` — envia a prova on-chain.


\#\# 9. Segurança e Modelo de Ameaças


\#\#\# 9.1 Garantias

- \*\*Elegibilidade:\*\* É impossível gerar uma prova válida sem um \`secret\` cujo \*commitment\* esteja na Merkle Tree com a raiz pública.

- \*\*Voto único:\*\* O \*nullifier\* é deterministicamente derivado do \`secret\` e do \`election\_id\`. O contrato rejeita \*nullifiers\* repetidos.

- \*\*Integridade do voto:\*\* A prova vincula o voto (\`0\` ou \`1\`) ao \*nullifier\* e à elegibilidade. O contrato só aceita a prova se todas as restrições forem satisfeitas.

- \*\*Transparência:\*\* O placar e os \*nullifiers\* usados são públicos e auditáveis.


\#\#\# 9.2 Limitações

- \*\*Anonimato dependente do tamanho do conjunto:\*\* Se a lista de elegíveis for muito pequena (ex.: 2 pessoas), o anonimato é fraco. Recomenda-se uma lista maior.

- \*\*Vínculo com a carteira:\*\* A transação é assinada pela carteira do eleitor, portanto o endereço que paga a taxa é público. No entanto, esse endereço \*\*não\*\* é vinculado ao \*commitment\* na lista. O anonimato é sobre a identidade na lista, não sobre o endereço financiador.

- \*\*Voto público:\*\* A escolha (GTA 6 ou Zelda) é visível on-chain, mas não está ligada à identidade. Isso é padrão em votações anônimas (anonimato do eleitor, não do voto).

- \*\*Confiança no administrador:\*\* O administrador define a raiz de Merkle. Se o administrador for malicioso, pode incluir eleitores falsos. Para o escopo do bounty, isso é aceitável (testnet).


\#\#\# 9.3 Ameaças e Mitigações

| Ameaça | Mitigação |

|--------|-----------|

| Prova inválida | O verificador Groth16 rejeita. Teste automatizado demonstrará isso. |

| Voto duplo | \*Nullifier\* único por \`(secret, electionId)\`; contrato reverte se já usado. |

| Uso de segredo de outra pessoa | O atacante precisaria do \`secret\` e do caminho de Merkle. Os segredos são distribuídos off-chain de forma segura. |

| \*Front-running\* | O voto é público, mas o \*nullifier\* impede que o atacante vote no lugar da vítima sem o \`secret\`. |


\#\# 10. Plano de Testes


\#\#\# 10.1 Teste de Prova Válida

- Gerar \`input.json\` com \`secret\` válido e \`vote=0\`.

- Executar \`ctg zk prove\` → \`proof.json\`.

- Invocar \`vote\` → transação bem-sucedida, placar incrementado.


\#\#\# 10.2 Teste de Prova Inválida

- Modificar o \`vote\` no \`public.json\` sem regenerar a prova (ou usar um \`secret\` que não está na árvore).

- Invocar \`vote\` → o contrato deve reverter com erro de verificação.


\#\#\# 10.3 Teste de Voto Duplo

- Usar o mesmo \`secret\` e \`electionId\` para gerar duas provas.

- Invocar \`vote\` duas vezes → a segunda deve falhar com erro de \*nullifier\* já usado.


\#\#\# 10.4 Testes Unitários (Rust)

- Testar \`initialize\` e \`get\_tally\`.

- Testar a lógica de \`vote\` com provas mockadas (se possível) ou usar o ambiente de teste do Soroban.


\#\# 11. Entregáveis


| Entregável | Descrição |

|------------|-----------|

| \*\*Repositório GitHub\*\* | Código completo: circuito Circom, contrato Soroban, frontend, scripts de prova e deploy. |

| \*\*Instruções de Deploy\*\* | Passo a passo no README para reproduzir o deploy na testnet. |

| \*\*Teste Automatizado\*\* | Script que demonstra a rejeição de prova inválida (ex.: \`npm test\` ou script shell). |

| \*\*Vídeo Demo (≤ 3 min)\*\* | Mostrando: conexão da carteira, seleção do jogo, geração da prova, voto aceito, tentativa de voto duplo rejeitada, e prova inválida rejeitada. |

| \*\*Caatinga Friction Log\*\* | Documento listando dificuldades encontradas ao usar o Caatinga (ex.: configuração do circuito, problemas com a dev ceremony, etc.). |


\#\# 12. Cronograma (Sugestão)


| Fase | Duração | Atividades |

|------|---------|------------|

| Setup | 1 dia | \`ctg zk init\`, adaptação do circuito, build. |

| Contrato | 2 dias | Adaptação do verificador para \*nullifiers\* e placar. |

| Frontend | 2 dias | UI com cards, conexão Freighter, integração com prova. |

| Testes | 1 dia | Testes de prova válida, inválida e voto duplo. |

| Documentação | 1 dia | README, friction log, gravação do vídeo. |


\#\# 13. Riscos e Mitigações


| Risco | Impacto | Mitigação |

|-------|---------|-----------|

| Complexidade do circuito Circom | Alto | Começar com profundidade de Merkle baixa (4) e usar Poseidon; testar localmente com \`snarkjs\` antes de integrar ao Caatinga. |

| Problemas com a \*dev ceremony\* | Médio | Usar o fluxo padrão do Caatinga para testnet; a \*dev ceremony\* é explicitamente permitida para testnet. |

| Integração do frontend com a prova | Médio | Usar \`@caatinga/client\` para serialização da prova e chamada do contrato; testar em ambiente local primeiro. |

| Tempo de geração de prova no browser | Baixo | Poseidon + árvore pequena mantêm a prova rápida; se necessário, gerar a prova via CLI e colar no frontend (mas o ideal é no browser). |


---


Este SDD cobre todos os pontos exigidos pelo bounty, mantendo a simplicidade e o foco no fluxo ZK com Caatinga. A originalidade está no circuito (Merkle + \*nullifier\* para votação binária) e na aplicação temática (GTA 6 vs. Zelda), sem extrapolar o escopo.
