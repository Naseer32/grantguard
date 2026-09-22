# GrantGuard

![CI](https://github.com/Naseer32/grantguard/actions/workflows/ci.yml/badge.svg)



**Trust-minimized milestone verification for grants and bounty programs, built on GenLayer.**

Live App: `TODO — deploy and paste your frontend URL`
Contract: `0x4aB5f14BF3B95739587124a54A49D9AdaE9c3EdF` (GenLayer Studio / Studionet)
Deploy tx (create_campaign): `0xc6a707b5b272c14c8ca4f5b04010cb1a4245223bb73cec73050ac50b755977c1`
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
## Live Verification Example

A real run against the deployed contract, submission id `1`:

| Step | Tx hash |
|---|---|
| `create_campaign` | `0xc6a707b5b272c14c8ca4f5b04010cb1a4245223bb73cec73050ac50b755977c1` |
| `submit_milestone` | `0x1a93be4b769ce36d87c71fc45a26f435e6a3f54d72b44c61efa95fb358499889` |
| `verify_submission` | `0xf1bdfdf23919af0d0f28e9c38600cefed0bed35c047b834cee02f8ba9aa61c89` |

`evidence_url` submitted: this repository's GitHub page (`https://github.com/Naseer32/grantguard`).

Result returned by `get_submission(1)`:

\`\`\`json
{
  "id": 1,
  "submitter": "0xbd6d84fc12ae3b9b3110fcc9eff91ddf5d59aa01",
  "evidence_url": "https://github.com/Naseer32/grantguard",
  "status": "rejected",
  "confidence": "high",
  "reasoning": "The evidence does not provide a working, publicly accessible demo URL as required by the campaign spec."
}
\`\`\`

This is a deliberately included **correct rejection**, not a cherry-picked
success: the campaign spec requires a live, working demo, and a source
repository isn't one. The validators caught that with high confidence —
concrete evidence the consensus judging is discriminating for real,
not rubber-stamping whatever gets submitted.
## What's Next

- Owner-configurable multiple concurrent campaigns (currently one
  campaign per deployed contract)
- Appeal / re-verification path for disputed rejections
