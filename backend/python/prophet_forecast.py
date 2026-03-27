import logging
import json
import math
import os
import sys
import tempfile
from datetime import datetime

os.environ.setdefault("MPLCONFIGDIR", tempfile.gettempdir())
os.environ.setdefault("XDG_CACHE_HOME", tempfile.gettempdir())

import pandas as pd
from prophet import Prophet

logging.getLogger("cmdstanpy").disabled = True
logging.getLogger("prophet").disabled = True


def load_payload():
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("Missing forecast payload")
    return json.loads(raw)


def to_frame(history):
    frame = pd.DataFrame(history or [])
    if frame.empty:
        raise ValueError("History is required")
    if "ds" not in frame.columns or "y" not in frame.columns:
        raise ValueError("History must contain ds and y fields")
    frame["ds"] = pd.to_datetime(frame["ds"])
    frame["y"] = pd.to_numeric(frame["y"], errors="coerce").fillna(0.0)
    frame = frame.groupby("ds", as_index=False)["y"].sum().sort_values("ds")
    if len(frame.index) < 2:
        raise ValueError("At least two history points are required")
    return frame


def build_model(frame):
    yearly = len(frame.index) >= 60
    return Prophet(
        weekly_seasonality=True,
        daily_seasonality=False,
        yearly_seasonality=yearly,
        seasonality_mode="additive",
        interval_width=0.8,
    )


def safe_float(value):
    if value is None:
        return 0.0
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return 0.0
    return float(value)


def round_float(value, digits=2):
    return round(safe_float(value), digits)


def compute_metrics(actual, predicted):
    if not actual:
        return {"mae": 0.0, "mape": 0.0, "rmse": 0.0, "points": 0}
    diffs = [abs(a - p) for a, p in zip(actual, predicted)]
    mae = sum(diffs) / len(diffs)
    sq = [(a - p) ** 2 for a, p in zip(actual, predicted)]
    rmse = math.sqrt(sum(sq) / len(sq))
    pct_terms = [abs((a - p) / a) for a, p in zip(actual, predicted) if a]
    mape = (sum(pct_terms) / len(pct_terms) * 100) if pct_terms else 0.0
    return {
        "mae": round_float(mae),
        "mape": round_float(mape),
        "rmse": round_float(rmse),
        "points": len(actual),
    }


def evaluate(frame):
    if len(frame.index) < 8:
        avg = safe_float(frame["y"].mean())
        return {
            "mae": 0.0,
            "mape": 0.0,
            "rmse": 0.0,
            "points": 0,
            "fallback_avg": round_float(avg),
        }

    test_size = min(14, max(7, len(frame.index) // 5))
    if len(frame.index) - test_size < 2:
        test_size = max(2, len(frame.index) // 4)
    train = frame.iloc[:-test_size]
    test = frame.iloc[-test_size:]
    model = build_model(train)
    model.fit(train)
    forecast = model.predict(test[["ds"]])
    predicted = [max(0.0, safe_float(v)) for v in forecast["yhat"].tolist()]
    actual = [safe_float(v) for v in test["y"].tolist()]
    metrics = compute_metrics(actual, predicted)
    metrics["fallback_avg"] = round_float(safe_float(train["y"].mean()))
    return metrics


def run_forecast(frame, horizon_days):
    model = build_model(frame)
    model.fit(frame)
    future = model.make_future_dataframe(periods=horizon_days, freq="D", include_history=True)
    forecast = model.predict(future)
    tail = forecast.tail(horizon_days).copy()
    tail["yhat"] = tail["yhat"].clip(lower=0)
    tail["yhat_lower"] = tail["yhat_lower"].clip(lower=0)
    tail["yhat_upper"] = tail["yhat_upper"].clip(lower=0)
    return {
        "forecast_total": round_float(tail["yhat"].sum()),
        "avg_daily_demand": round_float(tail["yhat"].mean()),
        "ci_low_total": round_float(tail["yhat_lower"].sum()),
        "ci_high_total": round_float(tail["yhat_upper"].sum()),
        "forecast_points": [
            {
                "ds": row["ds"].strftime("%Y-%m-%d"),
                "yhat": round_float(row["yhat"]),
                "yhat_lower": round_float(row["yhat_lower"]),
                "yhat_upper": round_float(row["yhat_upper"]),
            }
            for _, row in tail.iterrows()
        ],
    }


def main():
    payload = load_payload()
    frame = to_frame(payload.get("history"))
    horizon_days = max(1, int(payload.get("horizon_days") or 30))
    metrics = evaluate(frame)
    forecast = run_forecast(frame, horizon_days)
    history_tail = frame.tail(14).copy()
    output = {
        "model": "PROPHET",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "history_points": len(frame.index),
        "history_tail": [
            {"ds": row["ds"].strftime("%Y-%m-%d"), "y": round_float(row["y"])}
            for _, row in history_tail.iterrows()
        ],
        **metrics,
        **forecast,
    }
    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover
        sys.stderr.write(json.dumps({"error": str(exc)}))
        sys.exit(1)
