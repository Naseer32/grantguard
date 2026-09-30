GrantGuard

"CI" (https://github.com/Naseer32/grantguard/actions/workflows/ci.yml/badge.svg)

Trust-minimized milestone verification for grants and bounty programs, built on GenLayer.

Live App: https://grantguard-seven.vercel.app
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
Live frontend| https://grantguard-seven.vercel.app
Campaign| GenLayer Hackathon Milestone Check
Campaign specification| The deployed URL must show a working, publicly accessible demo of the submitted project.
Campaign pool shown in app| 1.0000 GEN
Reward per milestone| 0.1000 GEN

Bradbury Test Evidence

The following transactions were performed against the Bradbury deployment. Transaction status and validator output are recorded as shown by the explorer.

Campaign setup

Action| Transaction
"create_campaign"| "0x43a2ecdf671b9d2df6cc65d06597f41b618bc4b399285e7fa53f0328fd7c8bea"
"fund_campaign"| "0x3016c5d210f64e5510aaf193ce7ce9b696ce05e14735f8ec0639d10c6a47959e"

The campaign was created with the title GenLayer Hackathon Milestone Check and funded with 1.00 GEN.

Initial verification attempts

The first evidence submissions were rejected by validator consensus. The returned explanations identified issues such as a source repository instead of a working demo, static page content, and missing visible proof of live functionality.

These results helped identify the need to ensure the deployed frontend visibly loads its wallet connection, campaign data, and submission workflow before evidence is evaluated.

Successful verification and reward transfer

A later submission used the live GrantGuard frontend as evidence.

Step| Method| Transaction
Submit evidence| "submit_milestone"| "0x36c1b1db3a23b032008e540794abfe716ee6c6e8a704251bb9c5e1c352d63d25"
Verify Submission #2| "verify_submission(2)"| "0xded9a3e190955313428e0c918b4024f47dbac7e49bd3c8dfb7a01c5d5727782b"
Claim reward| "claim_reward(2)"| "0x8d1ec473d692ec630fb05936e5d7ed0bef7082938993fab480b6fa40eef8bc25"

The verification transaction returned:

confidence$high | The deployed URL shows a working, publicly accessible demo of the submitted project, GrantGuard, which connects a wallet, displays live campaign spec and pool balance, and allows users to submit and verify evidence.

The claim transaction showed an internal transfer of 0.10 GEN to the submitter wallet:

"0x53b20BeADADe01b46a3fb5bdbC85D3A7B0f12A96"

The explorer showed the transactions as "accepted" after their consensus waiting windows, and displayed the reward transfer for the claim transaction.

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
"frontend/src/components/GrantGuardPanel.jsx"| Wallet connection, evidence submission, campaign display, and verification workflow
GenLayer validators| Evaluate submitted evidence against the campaign specification
Bradbury testnet| Contract execution and transaction records

Design Notes

- Campaign-specific evaluation: Validators assess evidence against a defined campaign specification rather than an unstructured claim.
- Explicit lifecycle checks: Contract methods enforce their required state before changing campaign or submission data.
- Consensus-friendly results: Verification relies on agreed result fields rather than requiring independently generated reasoning text to match exactly.
- On-chain settlement: Reward transfers are handled by the contract after the claim conditions are satisfied.

CI

The GitHub Actions workflow runs on pushes and pull requests.

- Contract lint: checks the GenLayer contract.
- Frontend lint and build: installs frontend dependencies, runs ESLint, and builds the Vite application.

Local Development

Contract

1. Open GenLayer Studio: https://studio.genlayer.com
2. Load "contracts/grant_guard.py".
3. Deploy to the intended GenLayer network.
4. Record the deployed contract address.
5. Configure the frontend to use that address and network.

Frontend

cd frontend
npm install
npm run dev

Known Limitations and Future Work

- Add an in-app verification action for existing submissions, so users do not need to call "verify_submission" separately through Studio.
- Improve the frontend's handling and display of pending transaction states.
- Support multiple concurrent campaigns.
- Add an appeal or re-verification workflow for disputed results.
- Investigate version-specific support for "wait_after_loaded" in "gl.nondet.web.render()" to improve evidence capture of client-rendered pages.

Demo Video

A short screen recording of the campaign setup, evidence submission, verification result, and reward claim can be added here when available.
