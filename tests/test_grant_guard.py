import pytest
from gltest import get_contract_factory, get_default_account


def deploy_grant_guard():
    factory = get_contract_factory("GrantGuard")
    account = get_default_account()
    return factory.deploy(account=account)


def create_campaign(contract):
    contract.create_campaign(
        "Frontend Grant",
        "Build and deliver a working Web3 frontend",
    )


def test_grant_guard_deploys():
    contract = deploy_grant_guard()
    assert contract is not None


def test_create_campaign():
    contract = deploy_grant_guard()

    create_campaign(contract)

    info = contract.get_campaign_info()

    assert info["title"] == "Frontend Grant"
    assert info["spec"] == "Build and deliver a working Web3 frontend"
    assert info["created"] is True
    assert info["submission_count"] == 0


def test_create_campaign_rejects_empty_title():
    contract = deploy_grant_guard()

    with pytest.raises(Exception):
        contract.create_campaign(
            "",
            "Build and deliver a working Web3 frontend",
        )


def test_create_campaign_rejects_empty_spec():
    contract = deploy_grant_guard()

    with pytest.raises(Exception):
        contract.create_campaign(
            "Frontend Grant",
            "   ",
        )


def test_create_campaign_only_once():
    contract = deploy_grant_guard()

    create_campaign(contract)

    with pytest.raises(Exception):
        contract.create_campaign(
            "Second Campaign",
            "Another campaign spec",
        )


def test_submit_milestone():
    contract = deploy_grant_guard()
    create_campaign(contract)

    submission_id = contract.submit_milestone(
        "https://example.com/demo",
        "The frontend connects a wallet and displays campaign information.",
    )

    assert int(submission_id) == 1

    submission = contract.get_submission(submission_id)

    assert int(submission.id) == 1
    assert submission.evidence_url == "https://example.com/demo"
    assert submission.status == "pending"
    assert submission.paid is False


def test_submit_milestone_rejects_before_campaign_creation():
    contract = deploy_grant_guard()

    with pytest.raises(Exception):
        contract.submit_milestone(
            "https://example.com/demo",
            "Frontend evidence",
        )


def test_submit_milestone_rejects_empty_url():
    contract = deploy_grant_guard()
    create_campaign(contract)

    with pytest.raises(Exception):
        contract.submit_milestone(
            " ",
            "Frontend evidence",
        )


def test_submission_ids_increment():
    contract = deploy_grant_guard()
    create_campaign(contract)

    first_id = contract.submit_milestone(
        "https://example.com/first",
        "First submission",
    )
    second_id = contract.submit_milestone(
        "https://example.com/second",
        "Second submission",
    )

    assert int(first_id) == 1
    assert int(second_id) == 2

    info = contract.get_campaign_info()
    assert info["submission_count"] == 2


def test_get_submission_rejects_invalid_id():
    contract = deploy_grant_guard()

    with pytest.raises(Exception):
        contract.get_submission(1)


def test_verify_submission_rejects_invalid_id():
    contract = deploy_grant_guard()

    with pytest.raises(Exception):
        contract.verify_submission(1)


def test_claim_reward_rejects_invalid_id():
    contract = deploy_grant_guard()

    with pytest.raises(Exception):
        contract.claim_reward(1)
