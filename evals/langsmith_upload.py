"""
Optional: mirrors each case's local trace to LangSmith, with the same metadata
schema (case id, run name, prompt version, dataset version, expected and
predicted output, errors, tokens, latency) and one child run per LLM / tool call.

Only active when LANGSMITH_API_KEY is set (plus LANGSMITH_PROJECT, default
"wic-eval"). Never sends API keys; the investor fixtures are synthetic.
"""
import os
from datetime import datetime, timezone


def _ts(epoch: float) -> datetime:
    return datetime.fromtimestamp(epoch, tz=timezone.utc)


def maybe_upload(case: dict, row: dict):
    if not os.getenv("LANGSMITH_API_KEY"):
        return
    from langsmith.run_trees import RunTree

    project = os.getenv("LANGSMITH_PROJECT", "wic-eval")
    start = datetime.fromisoformat(row["started_at"])
    out = row["output"]
    root = RunTree(
        name=f"ask:{case['id']}", run_type="chain", project_name=project, start_time=start,
        inputs={"question": case["input"], "history": case.get("history") or [], "fixture": case["fixture"]},
        extra={"metadata": {
            "case_id": case["id"], "run_name": row["run_name"], "prompt_version": row.get("prompt_version"),
            "dataset_version": row["dataset_version"], "scenario": case["scenario"],
            "expected": case["expected"], "predicted_route": out.get("route"),
            "predicted_action": out.get("action"), "error": row.get("error"),
            "latency_s": row["latency_s"], "rate_limit_wait_s": row["rate_limit_wait_s"],
            "prompt_tokens": row["prompt_tokens"], "completion_tokens": row["completion_tokens"],
        }},
    )
    for s in row["spans"]:
        child = root.create_child(
            name=s["name"], run_type="llm" if s["type"] == "llm" else "tool", start_time=_ts(s["start"]),
            inputs={"model": s.get("model"), "args": s.get("args")},
            extra={"metadata": {k: s.get(k) for k in ("model", "prompt_tokens", "completion_tokens",
                                                       "rate_limit_wait_s", "status")}},
        )
        child.end(outputs={"latency_s": s["latency_s"]}, error=s.get("error"),
                  end_time=_ts(s["start"] + s["latency_s"] + s.get("rate_limit_wait_s", 0)))
    root.end(outputs={"route": out.get("route"), "action": out.get("action"),
                      "confidence": out.get("confidence"), "answer": out.get("answer") or out.get("message")},
             error=row.get("error"), end_time=_ts(start.timestamp() + row["wall_s"]))
    root.post(exclude_child_runs=False)
