# GrantGuard



![CI](https://github.com/Naseer32/grantguard/actions/workflows/ci.yml/badge.svg)



Open grants and bounties with AI-verified milestones, built on GenLayer.
Anyone can create a funded campaign. Anyone can submit evidence. GenLayer
validators judge it against the campaign spec, and the contract pays the reward.

- **Live app:** https://grantguard-seven.vercel.app
- **Network:** GenLayer Bradbury Testnet
- **Contract:** [`0x849973aB0AA7e353c8AE6eBD5B53C8dAf8281979`](https://explorer-bradbury.genlayer.com/address/0x849973aB0AA7e353c8AE6eBD5B53C8dAf8281979)

## Overview

Grant and bounty programs usually depend on manual review to decide whether
submitted work meets a requirement. That creates bottlenecks and decisions that
are hard to inspect later.

GrantGuard moves the whole loop on-chain:

1. A creator opens a **campaign**: a title, a spec ("what counts as done"), a
   fixed reward per milestone, and a GEN reward pool.
2. A builder **submits** a public URL and a description as evidence.
3. Anyone can trigger **verification**. GenLayer validators fetch the evidence
   page and independently judge it against the spec.
4. The submitter of a verified submission **claims** the reward from that
   campaign's pool.
5. The creator can **close** the campaign and **withdraw** the part of the pool
   that is not reserved for pending or unclaimed submissions.

Judgment and money are deliberately separate. `verify_submission` only decides;
funds move only in `claim_reward` and `withdraw_remaining`, which are fully
deterministic.

## Using the app

1. Open the live app. Campaigns are visible without a wallet.
2. Click **Connect Wallet** (top right). The app switches your wallet to Bradbury.
3. **Create** a campaign, or open one and **Submit evidence**.
4. Click **Verify with validators** on a pending submission. This usually takes
   a few minutes.
5. If verified, the submitter clicks **Claim**.
6. Creators manage their campaign (add funds, close, withdraw) from the campaign page.
7. The **Contract** tab lets you call every method directly, like GenLayer Studio.

## Contract methods

| Method | Who | What it does |
| --- | --- | --- |
| `create_campaign(title, spec, reward_per_milestone)` payable | anyone | Creates a campaign; attached GEN becomes its pool |
| `fund_campaign(campaign_id)` payable | anyone | Tops up an open campaign |
| `submit_milestone(campaign_id, evidence_url, description)` | anyone except the creator | Submits evidence |
| `verify_submission(submission_id)` | anyone | Validators judge the evidence against the spec |
| `claim_reward(submission_id)` | the submitter | Pays the reward from the campaign pool, once |
| `close_campaign(campaign_id)` | creator | Stops new submissions |
| `withdraw_remaining(campaign_id)` | creator, after closing | Returns the unreserved part of the pool |

Views: `get_campaign_count`, `get_campaign`, `get_campaigns`,
`get_campaigns_by_creator`, `get_campaign_submissions`, `get_submission`,
`get_submissions_by_submitter`.

## Safety rules enforced by the contract

- The reward per milestone is fixed at creation, so it cannot be changed under a submitter.
- A creator cannot submit to their own campaign.
- A wallet with a verified submission in a campaign cannot submit again there.
- Only the submitter can claim, only once, and only if the pool covers the reward.
- State is updated before funds are sent.
- A creator can never withdraw funds reserved for pending or verified-but-unpaid submissions.
- Consensus requires agreement only on the decision (verdict and confidence),
  not on reasoning text or the raw fetched page.
- Evidence text is passed to the validators as data, with instructions to ignore
  any attempt inside it to change their behavior.

## Bradbury test evidence (current contract)

Executed against `0x849973aB0AA7e353c8AE6eBD5B53C8dAf8281979` with two wallets
(creator and builder).

| Step | Result | Transaction |
| --- | --- | --- |
| `create_campaign` | ok | `0xc23295d2446a27d0b08c7db14f5aec55637dba4534d71c1f48b03ca957591684` |
| `submit_milestone` (builder) | ok | `0x8c55440106c0233e3464940f010f9e4d8a67b5de25bdc744512067ea2cc4e76c` |
| `verify_submission` | verified | `0xba912c5c562ff3e3502c05e32e6f59cf90cda22855bb97056930cf04a5f0adf6` |
| `claim_reward` | reward paid | `0xb13981be218f6ebd0e32317ab621d5207d4a9c8343c3e9caa0193f37f92e4b36` |
| `claim_reward` again | rejected (double claim) | `0x93807c432023819042ef2aa327f633db94bfd3907a87c477da2919bfea1d8d51` |
| `submit_milestone` by the creator | rejected | `0xe26ccb8e7a7a6f51e56fdec478dc17515338a851c2e4d4997d2193ff1d359dfe` |
| `submit_milestone` by the builder again | rejected | `0x6aef5f5741d755f5b297ebf4631b25536d75cf912a8461adf767c41ce49d65a3` |
| `close_campaign` | ok | `0x92f86386acbfcb34167710b733697aadcddea10c84ca573b0468aee4aa6cb23b` |
| `withdraw_remaining` | remainder returned to the creator | `0x3a1406a57e3df114af3d12b55365cda088930fc66ddfe7aaab8abf1e3ec8a43c` |

The rejected transactions show the contract's protections working: no second
payout, no self-submission, no repeat submission after a verified one.

## Findings during development

Real evidence-capture problems were found and fixed. They are kept here on purpose.

- **Client-rendered pages.** A single-page app fetched as plain text, or captured
  before its on-chain data loaded, could be judged as empty.
- **Heavy HTML heads.** An earlier v2 deployment rejected a valid GitHub
  repository because the contract sent only the first 6000 characters of raw
  HTML, which on GitHub is navigation and scripts, not the README. The current
  contract judges the visible page text and falls back to the rendered HTML with
  scripts, styles and tags removed when the text is nearly empty.
- **Slow RPC confirmations.** The frontend now retries transaction confirmation
  polling and always refreshes its data after an action, so a temporary RPC
  error no longer looks like a failed transaction.

## Version 1 (single campaign), kept as history

The first deployment was a single-campaign, owner-only contract at
`0x8Fc59D3a4dB29418eEb181964Ac62f39Bdb21247`. It proved the core loop on
Bradbury:

| Step | Transaction |
| --- | --- |
| `create_campaign` | `0x43a2ecdf671b9d2df6cc65d06597f41b618bc4b399285e7fa53f0328fd7c8bea` |
| `fund_campaign` (1 GEN) | `0x3016c5d210f64e5510aaf193ce7ce9b696ce05e14735f8ec0639d10c6a47959e` |
| `submit_milestone` | `0x36c1b1db3a23b032008e540794abfe716ee6c6e8a704251bb9c5e1c352d63d25` |
| `verify_submission` | `0xded9a3e190955313428e0c918b4024f47dbac7e49bd3c8dfb7a01c5d5727782b` |
| `claim_reward` (0.10 GEN paid) | `0x8d1ec473d692ec630fb05936e5d7ed0bef7082938993fab480b6fa40eef8bc25` |
| second `claim_reward` (rejected) | `0xb55ef801d86f916bf6aa3fb1024798e1743c8b8aaa374affe25e612143089973` |

Version 2 replaced it so that anyone, not only one owner, can run campaigns.

## Repository structuregrantguard/
├── contracts/
│   └── grant_guard.py          # GrantGuard v2 intelligent contract
├── frontend/
│   └── src/
│       ├── App.jsx             # header, wallet connect, navigation
│       ├── lib.js              # contract address, reads, transactions
│       └── components/
│           ├── Campaigns.jsx   # campaign list, create form, my activity
│           ├── CampaignView.jsx# campaign page, submit, verify, claim, manage
│           ├── Methods.jsx     # Studio-style method explorer
│           └── ui.jsx          # shared UI pieces
├── tests/
└── .github/workflows/ci.yml## Local development

Contract: open GenLayer Studio, load `contracts/grant_guard.py`, deploy to the
target network, then set `CONTRACT_ADDRESS` in `frontend/src/lib.js`.

Frontend:

```bash
cd frontend
npm install
npm run dev## Local development

Contract: open GenLayer Studio, load `contracts/grant_guard.py`, deploy to the
target network, then set `CONTRACT_ADDRESS` in `frontend/src/lib.js`.

Frontend:

```bash
cd frontend
npm install
npm run dev## Local development

Contract: open GenLayer Studio, load `contracts/grant_guard.py`, deploy to the
target network, then set `CONTRACT_ADDRESS` in `frontend/src/lib.js`.

Frontend:

```bash
cd frontend
npm install
npm run dev
## Local development

Contract: open GenLayer Studio, load `contracts/grant_guard.py`, deploy to the
target network, then set `CONTRACT_ADDRESS` in `frontend/src/lib.js`.

Frontend:

```bash
cd frontend
npm install
npm run dev
CI runs the contract lint, then frontend lint and build, on every push and pull request.
Known limitations and future work
Testnet only, and unaudited. Do not use it with funds you cannot lose.
Validators see the first part of the evidence page's text, so key proof should
be visible near the top of the page.
Evidence must be publicly reachable without a login.
Judgment depends on the quality of the campaign spec, so creators should write
specs that can be checked from a public page.
Anyone can submit, so a popular campaign can receive spam. Adding a deposit or
a per-wallet limit is a natural next step.
There is no appeal or re-verification flow for a rejected submission; the
builder can submit new evidence.
Verification cost is paid by whoever triggers it.
Demo video
Add the link here when the recording is ready.
