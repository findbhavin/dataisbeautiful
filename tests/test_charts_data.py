"""
Test cases for chart data APIs - ensures data structure is valid for charts to render.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_market_share_has_required_structure():
    """Market Share (donut) chart requires market_share array with carrier, subscriber_share_pct."""
    response = client.get("/api/analytics/market-wide")
    assert response.status_code == 200
    data = response.json()
    assert "market_share" in data
    assert isinstance(data["market_share"], list)
    assert len(data["market_share"]) > 0
    for item in data["market_share"]:
        assert "carrier" in item
        assert "subscriber_share_pct" in item
        assert isinstance(item["subscriber_share_pct"], (int, float))


def test_market_share_top10_states():
    """Top 10 States chart requires top10_states array."""
    response = client.get("/api/analytics/market-wide")
    assert response.status_code == 200
    data = response.json()
    assert "top10_states" in data
    assert isinstance(data["top10_states"], list)
    assert len(data["top10_states"]) >= 1
    for item in data["top10_states"]:
        assert "state" in item
        assert "customers_m" in item


def test_metros_has_required_structure():
    """Metros (stacked bar) chart requires top10_metros with metro, verizon, tmobile, att, others."""
    response = client.get("/api/analytics/metros")
    assert response.status_code == 200
    data = response.json()
    assert "top10_metros" in data
    assert isinstance(data["top10_metros"], list)
    assert len(data["top10_metros"]) > 0
    keys = ["metro", "verizon", "tmobile", "att", "others"]
    for item in data["top10_metros"]:
        for k in keys:
            assert k in item, f"Missing key {k} in metro item"


def test_spectrum_has_required_structure():
    """Spectrum chart requires spectrum_depth_nationwide with band and carrier keys."""
    response = client.get("/api/analytics/spectrum")
    assert response.status_code == 200
    data = response.json()
    assert "spectrum_depth_nationwide" in data
    assert isinstance(data["spectrum_depth_nationwide"], list)
    assert len(data["spectrum_depth_nationwide"]) > 0
    for item in data["spectrum_depth_nationwide"]:
        assert "band" in item
        assert "tmobile_mhz" in item or "att_mhz" in item or "verizon_mhz" in item


def test_revenue_has_required_structure():
    """Revenue chart requires revenue_top10 with state, annual_revenue_b."""
    response = client.get("/api/analytics/revenue-by-state")
    assert response.status_code == 200
    data = response.json()
    assert "revenue_top10" in data
    assert isinstance(data["revenue_top10"], list)
    assert len(data["revenue_top10"]) > 0
    for item in data["revenue_top10"]:
        assert "state" in item
        assert "annual_revenue_b" in item


def test_mobile_data_for_top_states_by_operator():
    """Mobile data for Top States by operator requires by_state with operator totals."""
    response = client.get("/api/mobile/data")
    assert response.status_code == 200
    data = response.json()
    assert "by_state" in data
    assert isinstance(data["by_state"], list)
    for item in data["by_state"]:
        assert "state_name" in item or "state_iso" in item
        assert "verizon_total" in item
        assert "tmobile_total" in item
        assert "att_total" in item
        assert "others_total" in item
