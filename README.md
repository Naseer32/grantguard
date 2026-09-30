GrantGuard

"CI" (https://github.com/Naseer32/grantguard/actions/workflows/ci.yml/badge.svg)

Trust-minimized milestone verification for grants and bounty programs, built on GenLayer.

Live App: "https://grantguard-seven.vercel.app"
Network: GenLayer Bradbury Testnet
Contract: "0x8Fc59D3a4dB29418eEb181964Ac62f39Bdb21247"

Overview

GrantGuard is a grant and bounty verification application built with a GenLayer Intelligent Contract.

A campaign owner defines a milestone specification and funds a reward pool. Builders submit deployed URLs and descriptions as evidence. GenLayer validators evaluate the submitted evidence against the campaign specification. Approved submissions can claim their configured reward through the contract.

GrantGuard keeps milestone evaluation separate from deterministic on-chain campaign accounting and reward settlement.

The Problem

Grant and bounty programs often depend on manual review to determine whether submitted work satisfies a specification. This can create review bottlenecks and leave decisions difficult to inspect after the fact.

The Solution

GrantGuard provides an on-chain campaign and submission workflow:

- Campaign owners define the requirement.
- Builders submit evidence URLs and descriptions.
- Validators evaluate evidence against the campaign specification.
- The contract records verification results.
- Approved submissions can claim their configured reward.

How It Works

Owner:
  create_campaign(title, spec)
  fund_campaign(amount)

Builder:
  submit_milestone(evidence_url, description)

Verifier:
  verify_submission(submission_id)
  -> evidence is evaluated against the campaign spec
  -> validator result is recorded

Submitter:
  claim_reward(submission_id)
  -> transfers the configured reward when claim conditions are met

Read methods:
  get_campaign_info()
  get_submission(submission_id)
  get_submissions_by_submitter(address)

Live Deployment

Item| Value
Network| GenLayer Bradbury Testnet
Contract| "0x8Fc59D3a4dB29418eEb181964Ac62f39Bdb21247"
Live frontend| "https://grantguard-seven.vercel.app"
Campaign| GenLayer Hackathon Milestone Check
Campaign specification| The deployed URL must show a working, publicly accessible demo of the submitted project.
Campaign pool| 1.0000 GEN
Reward per milestone| 0.1000 GEN

Bradbury Test Evidence

The following transactions were executed against the Bradbury deployment.

1. Campaign creation

"create_campaign"

Transaction:

"0x43a2ecdf671b9d2df6cc65d06597f41b618bc4b399285e7fa53f0328fd7c8bea"

The campaign was created with the title:

GenLayer Hackathon Milestone Check

Specification:

«The deployed URL must show a working, publicly accessible demo of the submitted project.»

2. Campaign funding

"fund_campaign"

Transaction:

"0x3016c5d210f64e5510aaf193ce7ce9b696ce05e14735f8ec0639d10c6a47959e"

The campaign was funded with 1.00 GEN.

3. Milestone submission

"submit_milestone"

Transaction:

"0x36c1b1db3a23b032008e540794abfe716ee6c6e8a704251bb9c5e1c352d63d25"

Evidence URL:

"https://grantguard-seven.vercel.app"

The submission was finalized on Bradbury and became Submission #2.

4. Validator verification

"verify_submission(2)"

Transaction:

"0xded9a3e190955313428e0c918b4024f47dbac7e49bd3c8dfb7a01c5d5727782b"

Final status:

finalized

Validator confidence:

high

Validator result:

The deployed URL shows a working, publicly accessible demo of the submitted project, GrantGuard, which connects a wallet, displays live campaign spec and pool balance, and allows users to submit and verify evidence.

The verification transaction finalized with 15 L2 transactions and 9,033,471 gas.

GenLayer chain transaction:

"0x2358d011180bc2bfddc8ebea29756a06ccc419d1c87b40a19e0b2635c84aaa83"

5. Reward claim

"claim_reward(2)"

Transaction:

"0x8d1ec473d692ec630fb05936e5d7ed0bef7082938993fab480b6fa40eef8bc25"

The transaction included an internal transfer of:

0.10 GEN

to the submitting wallet:

"0x53b20BeADADe01b46a3fb5bdbC85D3a7B0f12A96"

GenLayer chain transaction:

"0xb0286b9390ac4246ce2adc6a00a17008fcd4d2251e31934b6effcc2a7e53b744"

End-to-End Result

The Bradbury test demonstrated the complete grant workflow:

create_campaign
      ↓
fund_campaign
      ↓
submit_milestone
      ↓
verify_submission(2)
      ↓
validator consensus: high confidence
      ↓
verification finalized
      ↓
claim_reward(2)
      ↓
0.10 GEN transfer

This test provides an end-to-end on-chain record covering campaign creation, funding, evidence submission, GenLayer validator verification, and reward settlement.

Initial Verification Findings

Earlier verification attempts were intentionally retained during development because they exposed real evidence-capture limitations.

Initial validator rejections included:

- A GitHub source repository submitted instead of a working deployed demo.
- The live SPA being fetched as plain text before its client-side content rendered.
- HTML evidence being captured before asynchronous on-chain campaign data became visible.
- A GenLayer Studio Explorer page also being captured without its dynamically loaded contract content.

These tests showed that client-rendered applications can be difficult for an evidence fetcher to evaluate when important content is loaded asynchronously.

The successful Bradbury verification demonstrates that the current deployed frontend provided sufficient visible evidence for the validator to determine that the application was a working public demo.

Repository Structure

grantguard/
├── contracts/
│   └── grant_guard.py
├── frontend/
│   ├── src/
│   │   └── components/
│   │       └── GrantGuardPanel.jsx
│   ├── package.json
│   └── .eslintrc.json
└── .github/
    └── workflows/
        └── ci.yml

Architecture

Layer| Responsibility
"contracts/grant_guard.py"| Campaign state, milestone submissions, verification, and reward settlement
"frontend/src/components/GrantGuardPanel.jsx"| Wallet connection, campaign display, evidence submission, and result display
GenLayer validators| Evaluate submitted evidence against the campaign specification
Bradbury testnet| Contract execution and transaction records

Design Notes

- Campaign-specific evaluation: Validators assess evidence against a defined campaign specification.
- Explicit lifecycle checks: Contract methods enforce their required state before changing campaign or submission data.
- Consensus-friendly results: Verification relies on agreed result fields rather than requiring independently generated reasoning text to match exactly.
- On-chain settlement: Reward transfers are handled by the contract after the claim conditions are satisfied.
- Public evidence: The deployed application itself can be submitted as evidence for validator evaluation.

CI

The GitHub Actions workflow runs on pushes and pull requests.

- Contract lint: checks the GenLayer contract.
- Frontend lint and build: installs frontend dependencies, runs ESLint, and builds the Vite application.

Local Development

Contract

1. Open GenLayer Studio: "https://studio.genlayer.com"
2. Load "contracts/grant_guard.py".
3. Deploy to the intended GenLayer network.
4. Record the deployed contract address.
5. Configure the frontend to use that address and network.

Frontend

cd frontend
npm install
npm run dev

Known Limitations and Future Work

- Add an in-app verification action for existing submissions so users do not need to call "verify_submission" separately through Studio.
- Improve frontend handling and display of pending transaction states.
- Support multiple concurrent campaigns.
- Add an appeal or re-verification workflow for disputed results.
- Investigate version-specific support for "wait_after_loaded" in "gl.nondet.web.render()" to improve evidence capture of client-rendered pages.

Demo Video

A short screen recording of the campaign setup, evidence submission, finalized validator verification, and reward claim can be added here when available.
