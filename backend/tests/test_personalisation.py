"""
The AI agents receive the investor profile and other assets, and the
strategy's concentration flags come from real weights and the user's limit
(not from the model). The LLM and market data are mocked — no network.
"""
from app.agents import portfolio_strategy_agent as strategy_agent
from app.agents import retirement_agent
from app.services import portfolio_service


def _quiet_market(monkeypatch):
    monkeypatch.setattr(portfolio_service, "fetch_current_price", lambda t: 100.0)
    monkeypatch.setattr(strategy_agent, "gather_evidence", lambda t, db: {})
    monkeypatch.setattr(strategy_agent, "get_company_financials", lambda t, db: None)


def test_strategy_prompt_and_flags_follow_the_profile(auth_client, user_id, db_session, monkeypatch):
    """T111 - Profile, other assets and the user's limit reach the strategy agent; flags are computed"""
    _quiet_market(monkeypatch)
    auth_client.post("/portfolio/holdings", json={"ticker": "AAA", "quantity": 7})
    auth_client.post("/portfolio/holdings", json={"ticker": "BBB", "quantity": 3})
    auth_client.put("/profile", json={"risk_tolerance": "conservative", "horizon_years": 5, "max_position_pct": 20})
    auth_client.post("/assets", json={"name": "Savings", "asset_class": "cash", "value": 15000})

    prompts = {}

    def fake_llm(system_prompt, user_prompt, **kwargs):
        prompts.update(system=system_prompt, user=user_prompt)
        # The model claims nonsense flags; the agent must override them
        return {"positions": [{"ticker": "AAA", "action": "trim", "concentration_flag": "NONE"},
                              {"ticker": "BBB", "action": "hold", "concentration_flag": "HIGH"}],
                "portfolio_health": {"overall_score": 60}, "priority_actions": []}

    monkeypatch.setattr(strategy_agent, "invoke_llm_json", fake_llm)
    result = strategy_agent.run_portfolio_strategy(db_session, user_id)

    assert "conservative risk tolerance, 5-year horizon, maximum 20% in any one position" in prompts["user"]
    assert "cash $15,000" in prompts["user"]
    assert "weight above 20%" in prompts["system"] and "weight above 12%" in prompts["system"]
    flags = {p["ticker"]: p["concentration_flag"] for p in result["positions"]}
    assert flags == {"AAA": "HIGH", "BBB": "HIGH"}  # 70% and 30%, both above 20%
    assert result["limits"] == {"high": 20.0, "medium": 12.0}
    assert result["generated_at"]


def test_retirement_agent_sees_net_worth_and_profile(auth_client, user_id, db_session, monkeypatch):
    """T112 - Other assets count toward retirement resources and the profile is included"""
    monkeypatch.setattr(portfolio_service, "fetch_current_price", lambda t: 100.0)
    auth_client.post("/portfolio/holdings", json={"ticker": "AAA", "quantity": 10})
    auth_client.post("/assets", json={"name": "Bonds", "asset_class": "bonds", "value": 9000})
    auth_client.put("/profile", json={"risk_tolerance": "moderate", "horizon_years": 15, "max_position_pct": 25})

    seen = {}
    monkeypatch.setattr(retirement_agent, "invoke_llm_json",
                        lambda s, u, **k: seen.update(user=u) or {"answer": "On track", "action_items": [], "confidence": "medium"})
    result = retirement_agent.run_retirement_analysis("Can I retire?", user_id, db_session)

    assert "- bonds: $9,000.00" in seen["user"]
    assert "Total net worth (stocks + other assets): $10,000.00" in seen["user"]
    assert "15-year horizon" in seen["user"]
    assert result["other_assets_total"] == 9000
