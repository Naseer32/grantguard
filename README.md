# GrantGuard

![CI](https://github.com/YOUR_USERNAME/grantguard/actions/workflows/ci.yml/badge.svg)

**Trust-minimized milestone verification for grants and bounty programs, built on GenLayer.**

Live App: `TODO — deploy and paste your frontend URL`
Contract: `TODO — paste your GenLayer Studio (Studionet) contract address`
Deploy tx: `TODO — paste your deployment tx hash`
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

```
Owner:    create_campaign(title, spec)
Builder:  submit_milestone(evidence_url, description) -> submission_id (pending)
Anyone:   verify_submission(submission_id)
              -> contract fetches evidence_url live
              -> validators independently judge it against spec
              -> consensus on (verdict, confidence) -> status: verified/rejected
Anyone:   get_submission(submission_id) -> result, confidence, reasoning
```

## Repository Structure

```
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
```

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
- **frontend-lint-build** — installs `frontend/`, runs ESLint, and bundles `GrantGuardPanel.jsx` with esbuild as a build sanity check

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
npm run lint
npm run build
```

Wire `GrantGuardPanel.jsx` into your app with genlayer-js, pointing
`CONTRACT_ADDRESS` at the Studionet address from the deploy step above.

## What's Next

- Owner-configurable multiple concurrent campaigns (currently one
  campaign per deployed contract)
- Appeal / re-verification path for disputed rejections
