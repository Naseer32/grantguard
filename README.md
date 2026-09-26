# GrantGuard



![CI](https://github.com/Naseer32/grantguard/actions/workflows/ci.yml/badge.svg)



**Trust-minimized milestone verification for grants and bounty programs, built on GenLayer.**

Live App: `https://grantguard-seven.vercel.app`
Contract: `0x43d6995Fcc7cEA83877369D2755375d458BABEae` (GenLayer Studio / Studionet)
Deploy tx (create_campaign): `TODO — paste the create_campaign tx hash for this contract`
Demo video: `TODO — 60–90s screen recording of the flow below`

## The Problem

Grant programs and bounty boards pay out based on someone reading a
submission and deciding, by hand, whether it satisfies the brief. That
doesn't scale, isn't consistent across reviewers, and leaves the payout
decision sitting with a single person's judgment call — with no public
record of *why* it was approved or rejected.

## The Solution

GrantGuard lets a program owner state a spec once (a Campaign), then
lets any builder submit a deployed URL as evidence. An Intelligent
Contract fetches that evidence live and asks multiple independent
GenLayer validators to agree on whether it satisfies the spec. The
verdict, confidence, and reasoning are stored on-chain — anyone can
check the result and the transaction that produced it.

## How It Works
Owner:    create_campaign(title, spec)
Builder:  submit_milestone(evidence_url, description) -> submission_id (pending)
Anyone:   verify_submission(submission_id)
-> contract fetches evidence_url live
-> validators independently judge it against spec
-> consensus on (verdict, confidence) -> status: verified/rejected
Anyone:   get_submission(submission_id) -> result, confidence, reasoning

cd ~/grantguard
cat > README.md << 'MDEOF'
# GrantGuard



![CI](https://github.com/Naseer32/grantguard/actions/workflows/ci.yml/badge.svg)



**Trust-minimized milestone verification for grants and bounty programs, built on GenLayer.**

Live App: `https://grantguard-seven.vercel.app`
Contract: `0x43d6995Fcc7cEA83877369D2755375d458BABEae` (GenLayer Studio / Studionet)
Deploy tx (create_campaign): `TODO — paste the create_campaign tx hash for this contract`
Demo video: `TODO — 60–90s screen recording of the flow below`

## The Problem

Grant programs and bounty boards pay out based on someone reading a
submission and deciding, by hand, whether it satisfies the brief. That
doesn't scale, isn't consistent across reviewers, and leaves the payout
decision sitting with a single person's judgment call — with no public
record of *why* it was approved or rejected.

## The Solution

GrantGuard lets a program owner state a spec once (a Campaign), then
lets any builder submit a deployed URL as evidence. An Intelligent
Contract fetches that evidence live and asks multiple independent
GenLayer validators to agree on whether it satisfies the spec. The
verdict, confidence, and reasoning are stored on-chain — anyone can
check the result and the transaction that produced it.

## How It Works

Owner:    create_campaign(title, spec)
Builder:  submit_milestone(evidence_url, description) -> submission_id (pending)
Anyone:   verify_submission(submission_id)
-> contract fetches evidence_url live
-> validators independently judge it against spec
-> consensus on (verdict, confidence) -> status: verified/rejected
Anyone:   get_submission(submission_id) -> result, confidence, reasoning

## Repository Structure

grantguard/
├── contracts/
│   └── grant_guard.py          # GenLayer Intelligent Contract
├── frontend/
│   ├── src/components/
│   │   └── GrantGuardPanel.jsx # Submit -> pending -> result UI
│   ├── package.json
│   └── .eslintrc.json
└── .github/workflows/
└── ci.yml                  # Lints the contract and lints+builds the frontend on every push/PR

## Architecture

| Layer | What it does |
|---|---|
| `contracts/grant_guard.py` | GenLayer Intelligent Contract — campaign + submission storage, live fetch, validator consensus |
| `frontend/src/components/GrantGuardPanel.jsx` | Submits evidence, triggers verification, polls for and displays the result |

## Design Notes

- **Named campaign context.** Judging a submission against a stated
  spec — not a bare claim with no shared frame of reference — gives
  every validator the same brief to reason against.
- **Explicit lifecycle guards.** Every write method checks its
  precondition (`campaign_created`, `status == "pending"`) before
  touching state, so re-verification and setup-before-launch failures
  are caught instead of silently corrupting stored results.
- **Consensus granularity.** Validators only need to agree on
  `(verdict, confidence)`, not on reasoning text or the raw fetched
  page — independent live fetches of the same URL and independent LLM
  calls are never byte-identical, so exact-matching free text would
  fail consensus almost every run.

## CI

Every push and PR runs two jobs (see `.github/workflows/ci.yml`):

- **contract-lint** — syntax-checks and lints `contracts/grant_guard.py` with flake8
- **frontend-lint-build** — installs `frontend/`, runs ESLint, and runs the real Vite production build

## Local Development

Deploy the contract via GenLayer Studio (https://studio.genlayer.com):

1. Open Studio and create a new contract.
2. Paste in `contracts/grant_guard.py` (keep the first-line `Depends` comment).
3. Run the constructor (no args) and deploy to Studionet.
4. Note the deployed contract address.

Frontend:

```bash
cd frontend
npm install
npm run dev

Wire GrantGuardPanel.jsx into your app with genlayer-js, pointing
CONTRACT_ADDRESS at the Studionet address from the deploy step above.
Live Verification Findings
Four real submissions were run against this contract (and two earlier
deployments during development) — all rejections, each for a
genuinely different and correctly-reasoned cause. This progression is
kept here deliberately: it's stronger evidence that the consensus
judging is discriminating for real than one lucky verified: true
would have been, and it surfaced a real, structural limitation worth
documenting for anyone building on gl.nondet.web.render().
#1 — Source repo instead of a demo. evidence_url: this
repository's GitHub page. Rejected — a source repo isn't a working
demo, which is exactly correct against the spec.

{"status": "rejected", "confidence": "high",
 "reasoning": "The evidence does not provide a working, publicly accessible demo URL as required by the campaign spec."}

#2 — Live app, but fetched as plain text. evidence_url: the live
frontend (https://grantguard-seven.vercel.app), fetched with
mode="text". Rejected — a client-rendered SPA's initial HTML shell
is nearly empty before its JavaScript runs, so a bare text snapshot
sees nothing.

{"status": "rejected", "confidence": "high",
 "reasoning": "The evidence only shows static text from a page and does not demonstrate a working, publicly accessible deployed demo or its functionality."}

This motivated switching the fetch to mode="html".
#3 — Same live app, mode="html". This time the fetch actually
succeeded and the validators saw real rendered markup (a disabled
submit button, form fields) — genuine progress. Still rejected,
because the async on-chain read that populates the campaign info box
hadn't resolved yet when the snapshot was taken, so there was no
visible proof of live contract data.

{"status": "rejected", "confidence": "high",
 "reasoning": "The evidence is static HTML markup only, showing a disabled submit button and no proof the app is deployed, publicly accessible, or connected to a live contract."}

#4 — GenLayer's own Studio explorer page, submitted specifically
to sidestep #3's timing gap with a page GrantGuard doesn't control.
Same failure mode anyway:

{"status": "rejected", "confidence": "high",
 "reasoning": "The evidence shows only the navigation/header HTML of the GenLayer Studio Explorer with no actual contract data, deployed address, transaction history, or method calls visible — the page content appears empty or not loaded, failing to demonstrate a working publicly accessible demo."}

This is the real finding: the gap isn't specific to GrantGuard's own
frontend. Any page that loads its real content asynchronously via
client-side JavaScript risks being snapshotted before that content
renders — including GenLayer's own tooling. wait_after_loaded exists
in principle to address this, but an attempt to pass it here produced
a native "2: inval..." error, suggesting either a version mismatch
or an argument signature this deployment doesn't accept as documented
— left as an open item for anyone continuing this project (see below).

What's Next
Resolve the wait_after_loaded argument error on gl.nondet.web.render()
(see Findings #4) — likely a version-specific signature issue, worth a
fresh look against current GenLayer docs/changelog
Owner-configurable multiple concurrent campaigns (currently one
campaign per deployed contract)
Appeal / re-verification path for disputed rejections
