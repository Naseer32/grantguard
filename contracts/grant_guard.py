# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from dataclasses import dataclass
import json
import hashlib
from genlayer import *


GRANT_ACTIVE = "active"
GRANT_COMPLETED = "completed"
GRANT_CANCELLED = "cancelled"

MILESTONE_PENDING = "pending"
MILESTONE_EVIDENCE_SUBMITTED = "evidence_submitted"
MILESTONE_VERIFYING = "verifying"
MILESTONE_VERIFIED = "verified"
MILESTONE_REJECTED = "rejected"
MILESTONE_CHALLENGED = "challenged"
MILESTONE_PAID = "paid"
MILESTONE_FINALIZED = "finalized"


@allow_storage
@dataclass
class Grant:
    id: str
    creator: str
    title: str
    description: str
    status: str
    funded_amount: str
    reserved_amount: str
    released_amount: str
    milestone_count: u256


@allow_storage
@dataclass
class Milestone:
    id: str
    grant_id: str
    recipient: str
    title: str
    requirements: str
    reward: str
    status: str
    requirements_frozen: bool
    evidence_url: str
    evidence_description: str
    evidence_digest: str
    challenge_used: bool
    verification_decision: str
    verification_summary: str
    released_amount: str


class GrantGuard(gl.Contract):
    grants: TreeMap[Address, TreeMap[str, Grant]]
    milestones: TreeMap[Address, TreeMap[str, TreeMap[str, Milestone]]]

    next_grant_seq: u256
    next_milestone_seq: u256

    def __init__(self):
        self.next_grant_seq = u256(1)
        self.next_milestone_seq = u256(1)

    def _get_grant(self, creator: Address, grant_id: str) -> Grant:
        creator_grants = self.grants.get_or_insert_default(creator)

        if grant_id not in creator_grants:
            raise gl.vm.UserError("[EXPECTED] grant does not exist")

        return creator_grants[grant_id]

    def _get_milestone(
        self,
        creator: Address,
        grant_id: str,
        milestone_id: str,
    ) -> Milestone:
        self._get_grant(creator, grant_id)

        grant_milestones = self.milestones.get_or_insert_default(creator)

        if grant_id not in grant_milestones:
            raise gl.vm.UserError("[EXPECTED] grant has no milestones")

        milestones = grant_milestones[grant_id]

        if milestone_id not in milestones:
            raise gl.vm.UserError("[EXPECTED] milestone does not exist")

        return milestones[milestone_id]

    @gl.public.write
    def create_grant(self, title: str, description: str) -> str:
        if not title.strip():
            raise gl.vm.UserError("[EXPECTED] title cannot be empty")

        if not description.strip():
            raise gl.vm.UserError("[EXPECTED] description cannot be empty")

        creator = gl.message.sender_address
        seq = int(self.next_grant_seq)
        grant_id = f"grant-{seq}"

        self.next_grant_seq = u256(seq + 1)

        grant = Grant(
            id=grant_id,
            creator=creator.as_hex,
            title=title,
            description=description,
            status=GRANT_ACTIVE,
            funded_amount="0",
            reserved_amount="0",
            released_amount="0",
            milestone_count=u256(0),
        )

        self.grants.get_or_insert_default(creator)[grant_id] = grant

        return grant_id

    @gl.public.write.payable
    def add_milestone(
        self,
        grant_id: str,
        recipient: Address,
        title: str,
        requirements: str,
    ) -> str:
        amount = gl.message.value

        if amount == u256(0):
            raise gl.vm.UserError("[EXPECTED] milestone reward must be greater than 0")

        if not title.strip():
            raise gl.vm.UserError("[EXPECTED] milestone title cannot be empty")

        if not requirements.strip():
            raise gl.vm.UserError("[EXPECTED] milestone requirements cannot be empty")

        creator = gl.message.sender_address
        grant = self._get_grant(creator, grant_id)

        if grant.status != GRANT_ACTIVE:
            raise gl.vm.UserError("[EXPECTED] grant is not active")

        seq = int(self.next_milestone_seq)
        milestone_id = f"milestone-{seq}"

        self.next_milestone_seq = u256(seq + 1)

        milestone = Milestone(
            id=milestone_id,
            grant_id=grant_id,
            recipient=str(recipient),
            title=title,
            requirements=requirements,
            reward=str(int(amount)),
            status=MILESTONE_PENDING,
            requirements_frozen=False,
            evidence_url="",
            evidence_description="",
            evidence_digest="",
            challenge_used=False,
            verification_decision="",
            verification_summary="",
            released_amount="0",
        )

        self.milestones \
            .get_or_insert_default(creator) \
            .get_or_insert_default(grant_id)[milestone_id] = milestone

        grant.funded_amount = str(
            int(grant.funded_amount) + int(amount)
        )

        grant.reserved_amount = str(
            int(grant.reserved_amount) + int(amount)
        )

        grant.milestone_count = u256(int(grant.milestone_count) + 1)

        return milestone_id

    @gl.public.write
    def freeze_milestone_requirements(
        self,
        grant_id: str,
        milestone_id: str,
    ) -> None:
        creator = gl.message.sender_address
        milestone = self._get_milestone(
            creator,
            grant_id,
            milestone_id,
        )

        if milestone.requirements_frozen:
            raise gl.vm.UserError("[EXPECTED] requirements already frozen")

        if milestone.status != MILESTONE_PENDING:
            raise gl.vm.UserError("[EXPECTED] milestone is not pending")

        milestone.requirements_frozen = True

    @gl.public.write
    def submit_evidence(
        self,
        grant_creator: Address,
        grant_id: str,
        milestone_id: str,
        evidence_url: str,
        description: str,
    ) -> None:
        grant_creator = Address(grant_creator)
        if not evidence_url.strip():
            raise gl.vm.UserError("[EXPECTED] evidence URL cannot be empty")

        milestone = self._get_milestone(
            grant_creator,
            grant_id,
            milestone_id,
        )

        sender = gl.message.sender_address

        if milestone.recipient != sender.as_hex:
            raise gl.vm.UserError("[EXPECTED] only the milestone recipient can submit evidence")

        if not milestone.requirements_frozen:
            raise gl.vm.UserError("[EXPECTED] milestone requirements must be frozen first")

        if milestone.status != MILESTONE_PENDING:
            raise gl.vm.UserError("[EXPECTED] milestone is not accepting evidence")

        milestone.evidence_url = evidence_url
        milestone.evidence_description = description
        milestone.evidence_digest = hashlib.sha256(
            (evidence_url + description).encode()
        ).hexdigest()
        milestone.status = MILESTONE_EVIDENCE_SUBMITTED

    @gl.public.write
    def request_verification(
        self,
        grant_creator: Address,
        grant_id: str,
        milestone_id: str,
    ) -> None:
        grant_creator = Address(grant_creator)
        milestone = self._get_milestone(
            grant_creator,
            grant_id,
            milestone_id,
        )

        if milestone.recipient != gl.message.sender_address.as_hex:
            raise gl.vm.UserError(
                "[EXPECTED] only the milestone recipient can request verification"
            )

        if not milestone.requirements_frozen:
            raise gl.vm.UserError("[EXPECTED] milestone requirements must be frozen first")

        if milestone.status == MILESTONE_EVIDENCE_SUBMITTED:
            milestone.status = MILESTONE_VERIFYING
            return

        if milestone.status == MILESTONE_CHALLENGED:
            milestone.status = MILESTONE_VERIFYING
            return

        raise gl.vm.UserError(
            "[EXPECTED] evidence must be submitted or milestone must be challenged"
        )

    def _apply_verification_result(
        self,
        milestone: Milestone,
        decision: str,
        summary: str,
    ) -> None:
        if milestone.status != MILESTONE_VERIFYING:
            raise gl.vm.UserError("[EXPECTED] milestone is not awaiting verification")

        if decision != "VERIFIED" and decision != "REJECTED":
            raise gl.vm.UserError("[EXPECTED] invalid verification decision")

        milestone.verification_decision = decision
        milestone.verification_summary = summary

        if decision == "VERIFIED":
            milestone.status = MILESTONE_VERIFIED
        else:
            milestone.status = MILESTONE_REJECTED

    @gl.public.write
    def challenge_milestone(
        self,
        grant_creator: Address,
        grant_id: str,
        milestone_id: str,
    ) -> None:
        grant_creator = Address(grant_creator)
        milestone = self._get_milestone(
            grant_creator,
            grant_id,
            milestone_id,
        )

        if milestone.recipient != gl.message.sender_address.as_hex:
            raise gl.vm.UserError(
                "[EXPECTED] only the milestone recipient can challenge"
            )

        if milestone.status != MILESTONE_REJECTED:
            raise gl.vm.UserError(
                "[EXPECTED] only a rejected milestone can be challenged"
            )

        if milestone.challenge_used:
            raise gl.vm.UserError(
                "[EXPECTED] milestone challenge already used"
            )

        milestone.challenge_used = True
        milestone.status = MILESTONE_CHALLENGED

    @gl.public.write
    def verify_milestone(
        self,
        grant_creator: Address,
        grant_id: str,
        milestone_id: str,
    ) -> None:
        grant_creator = Address(grant_creator)
        milestone = self._get_milestone(
            grant_creator,
            grant_id,
            milestone_id,
        )

        if milestone.status != MILESTONE_VERIFYING:
            raise gl.vm.UserError("[EXPECTED] milestone is not awaiting verification")

        milestone_title = milestone.title
        requirements = milestone.requirements
        evidence_url = milestone.evidence_url
        evidence_description = milestone.evidence_description
        evidence_digest = milestone.evidence_digest

        def judge() -> str:
            try:
                evidence_page = gl.nondet.web.render(
                    evidence_url,
                    mode="text",
                )
            except Exception:
                evidence_page = "[FETCH_FAILED]"

            prompt = f"""
You are verifying a grant milestone.

MILESTONE TITLE:
{milestone_title}

FROZEN REQUIREMENTS:
{requirements}

EVIDENCE URL:
{evidence_url}

EVIDENCE DESCRIPTION:
{evidence_description}

EVIDENCE DIGEST:
{evidence_digest}

FETCHED EVIDENCE:
{evidence_page[:6000]}

Decide whether the submitted evidence reasonably satisfies every frozen
requirement.

Return JSON only:
{{
    "decision": "VERIFIED" or "REJECTED",
    "summary": "short explanation"
}}

Rules:
- Choose VERIFIED only when the evidence reasonably satisfies every frozen requirement.
- Choose REJECTED when one or more requirements are not reasonably satisfied.
- Do not invent evidence that is not present.
- Base the decision only on the frozen requirements and submitted evidence.
"""

            result = gl.nondet.exec_prompt(
                prompt,
                response_format="json",
            )

            decision = str(result.get("decision", "REJECTED")).upper()
            summary = str(result.get("summary", ""))

            if decision != "VERIFIED" and decision != "REJECTED":
                decision = "REJECTED"

            return json.dumps(
                {
                    "decision": decision,
                    "summary": summary,
                },
                sort_keys=True,
            )

        result_json = gl.eq_principle.prompt_comparative(
            judge,
            principle=(
                'The "decision" field must be exactly the same. '
                'The summary may use different wording, but it must '
                'support the same decision using only the frozen '
                'requirements and submitted evidence.'
            ),
        )

        try:
            parsed = json.loads(result_json)
            decision = str(parsed.get("decision", "REJECTED")).upper()
            summary = str(parsed.get("summary", ""))
        except Exception:
            decision = "REJECTED"
            summary = "Could not parse validator decision"

        if decision != "VERIFIED" and decision != "REJECTED":
            decision = "REJECTED"

        self._apply_verification_result(
            milestone,
            decision,
            summary,
        )

    def _pay(self, to: str, amount: u256) -> None:
        recipient = gl.get_contract_at(Address(to))
        recipient.emit_transfer(value=amount)

    @gl.public.write
    def release_milestone(
        self,
        grant_creator: Address,
        grant_id: str,
        milestone_id: str,
    ) -> None:
        grant_creator = Address(grant_creator)
        grant = self._get_grant(grant_creator, grant_id)
        milestone = self._get_milestone(
            grant_creator,
            grant_id,
            milestone_id,
        )

        if milestone.status != MILESTONE_VERIFIED:
            raise gl.vm.UserError(
                "[EXPECTED] milestone must be verified before release"
            )

        reward = u256(int(milestone.reward))

        if reward == u256(0):
            raise gl.vm.UserError("[EXPECTED] milestone reward is zero")

        if int(grant.reserved_amount) < int(reward):
            raise gl.vm.UserError(
                "[EXPECTED] insufficient reserved milestone balance"
            )

        grant.reserved_amount = str(
            int(grant.reserved_amount) - int(reward)
        )
        grant.released_amount = str(
            int(grant.released_amount) + int(reward)
        )

        milestone.released_amount = str(int(reward))
        milestone.status = MILESTONE_PAID

        self._pay(milestone.recipient, reward)

    @gl.public.write
    def finalize_milestone(
        self,
        grant_creator: Address,
        grant_id: str,
        milestone_id: str,
    ) -> None:
        grant_creator = Address(grant_creator)
        grant = self._get_grant(grant_creator, grant_id)
        milestone = self._get_milestone(
            grant_creator,
            grant_id,
            milestone_id,
        )

        if milestone.status != MILESTONE_REJECTED:
            raise gl.vm.UserError(
                "[EXPECTED] only a rejected milestone can be finalized"
            )

        if not milestone.challenge_used:
            raise gl.vm.UserError(
                "[EXPECTED] milestone must use its challenge before finalization"
            )

        reward = int(milestone.reward)

        if int(grant.reserved_amount) < reward:
            raise gl.vm.UserError(
                "[EXPECTED] insufficient reserved milestone balance"
            )

        grant.reserved_amount = str(
            int(grant.reserved_amount) - reward
        )

        milestone.status = MILESTONE_FINALIZED

    @gl.public.view
    def get_grant(
        self,
        creator: Address,
        grant_id: str,
    ) -> Grant:
        creator = Address(creator)
        return self._get_grant(creator, grant_id)

    @gl.public.view
    def get_milestone(
        self,
        creator: Address,
        grant_id: str,
        milestone_id: str,
    ) -> Milestone:
        creator = Address(creator)
        return self._get_milestone(
            creator,
            grant_id,
            milestone_id,
        )
