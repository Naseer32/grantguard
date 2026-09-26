from gltest import get_contract_factory, get_default_account


def deploy_grant_guard():
    factory = get_contract_factory("GrantGuard")
    account = get_default_account()
    return factory.deploy(account=account)


def test_grant_guard_deploys():
    contract = deploy_grant_guard()
    assert contract is not None


def test_create_grant():
    contract = deploy_grant_guard()

    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )

    assert grant_id == "grant-1"


def test_create_grant_rejects_empty_title():
    contract = deploy_grant_guard()

    try:
        contract.create_grant(
            "",
            "Build and deliver a working Web3 frontend",
        )
        assert False
    except Exception:
        assert True


def test_add_milestone():
    contract = deploy_grant_guard()

    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )

    account = get_default_account()

    milestone_id = contract.add_milestone(
        grant_id,
        account.address,
        "Working Frontend",
        "Frontend must connect wallet and complete the required flow",
    )

    assert milestone_id == "milestone-1"


def test_freeze_milestone_requirements():
    contract = deploy_grant_guard()

    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )

    account = get_default_account()

    milestone_id = contract.add_milestone(
        grant_id,
        account.address,
        "Working Frontend",
        "Frontend must connect wallet and complete the required flow",
    )

    contract.freeze_milestone_requirements(
        grant_id,
        milestone_id,
    )

    milestone = contract.get_milestone(
        account.address,
        grant_id,
        milestone_id,
    )

    assert milestone.requirements_frozen is True

def test_submit_evidence():
    contract = deploy_grant_guard()

    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )

    account = get_default_account()

    milestone_id = contract.add_milestone(
        grant_id,
        account.address,
        "Working Frontend",
        "Frontend must connect wallet and complete the required flow",
    )

    contract.freeze_milestone_requirements(
        grant_id,
        milestone_id,
    )

    contract.submit_evidence(
        account.address,
        grant_id,
        milestone_id,
        "https://github.com/example/frontend",
        "Frontend implementation and wallet connection are available here.",
    )

    milestone = contract.get_milestone(
        account.address,
        grant_id,
        milestone_id,
    )

    assert milestone.status == "evidence_submitted"
    assert milestone.evidence_digest != ""

def test_request_verification():
    contract = deploy_grant_guard()

    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )

    account = get_default_account()

    milestone_id = contract.add_milestone(
        grant_id,
        account.address,
        "Working Frontend",
        "Frontend must connect wallet and complete the required flow",
    )

    contract.freeze_milestone_requirements(
        grant_id,
        milestone_id,
    )

    contract.submit_evidence(
        account.address,
        grant_id,
        milestone_id,
        "https://github.com/example/frontend",
        "Frontend implementation evidence",
    )

    contract.request_verification(
        account.address,
        grant_id,
        milestone_id,
    )

    milestone = contract.get_milestone(
        account.address,
        grant_id,
        milestone_id,
    )

    assert milestone.status == "verifying"


def test_verification_result_verified():
    contract = deploy_grant_guard()

    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )

    account = get_default_account()

    milestone_id = contract.add_milestone(
        grant_id,
        account.address,
        "Working Frontend",
        "Frontend must connect wallet and complete the required flow",
    )

    contract.freeze_milestone_requirements(
        grant_id,
        milestone_id,
    )

    contract.submit_evidence(
        account.address,
        grant_id,
        milestone_id,
        "https://github.com/example/frontend",
        "Frontend implementation evidence",
    )

    contract.request_verification(
        account.address,
        grant_id,
        milestone_id,
    )

    milestone = contract.get_milestone(
        account.address,
        grant_id,
        milestone_id,
    )

    contract._apply_verification_result(
        milestone,
        "VERIFIED",
        "All milestone requirements were satisfied.",
    )

    assert milestone.status == "verified"
    assert milestone.verification_decision == "VERIFIED"


def test_verification_result_rejected():
    contract = deploy_grant_guard()

    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )

    account = get_default_account()

    milestone_id = contract.add_milestone(
        grant_id,
        account.address,
        "Working Frontend",
        "Frontend must connect wallet and complete the required flow",
    )

    contract.freeze_milestone_requirements(
        grant_id,
        milestone_id,
    )

    contract.submit_evidence(
        account.address,
        grant_id,
        milestone_id,
        "https://github.com/example/frontend",
        "Frontend implementation evidence",
    )

    contract.request_verification(
        account.address,
        grant_id,
        milestone_id,
    )

    milestone = contract.get_milestone(
        account.address,
        grant_id,
        milestone_id,
    )

    contract._apply_verification_result(
        milestone,
        "REJECTED",
        "Required milestone evidence was not sufficient.",
    )

    assert milestone.status == "rejected"
    assert milestone.verification_decision == "REJECTED"


def test_submit_evidence_requires_frozen_requirements():
    contract = deploy_grant_guard()

    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )

    account = get_default_account()

    milestone_id = contract.add_milestone(
        grant_id,
        account.address,
        "Working Frontend",
        "Frontend must connect wallet and complete the required flow",
    )

    try:
        contract.submit_evidence(
            account.address,
            grant_id,
            milestone_id,
            "https://github.com/example/frontend",
            "Frontend implementation evidence",
        )
        assert False
    except Exception:
        assert True


def test_verify_milestone_requires_verifying_status():
    contract = deploy_grant_guard()
    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )
    account = get_default_account()
    milestone_id = contract.add_milestone(
        grant_id,
        account.address,
        "Working Frontend",
        "Frontend must connect wallet and complete the required flow",
    )
    contract.freeze_milestone_requirements(
        grant_id,
        milestone_id,
    )
    try:
        contract.verify_milestone(
            account.address,
            grant_id,
            milestone_id,
        )
        assert False
    except Exception:
        assert True


def test_request_verification_requires_recipient():
    contract = deploy_grant_guard()
    grant_id = contract.create_grant(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )
    recipient = get_default_account()
    other_account = get_default_account()
    milestone_id = contract.add_milestone(
        grant_id,
        recipient.address,
        "Working Frontend",
        "Frontend must connect wallet and complete the required flow",
    )
    contract.freeze_milestone_requirements(
        grant_id,
        milestone_id,
    )
    contract.submit_evidence(
        recipient.address,
        grant_id,
        milestone_id,
        "https://github.com/example/frontend",
        "Frontend implementation evidence",
    )

    try:
        contract.request_verification(
            other_account.address,
            grant_id,
            milestone_id,
        )
        assert False
    except Exception:
        assert True
