"""
Runs the golden dataset through the agent and scores it.

    cd evals
    ..\\backend\\venv\\Scripts\\python run_eval.py --run baseline          # agent runs -> runs.jsonl
    ..\\backend\\venv\\Scripts\\python run_eval.py --run baseline --score  # judge + scores -> scored.jsonl, summary.json

Runs resume: cases already in runs.jsonl are skipped, so an interrupted run
can be restarted. Use --cases H01,E03 to run a subset.
If LANGSMITH_API_KEY is set, each case is also uploaded as a LangSmith trace
(see langsmith_upload.py).
"""
import argparse
import json
import statistics
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import harness  # noqa: E402  (chdirs to backend and patches the app)
from evaluators import dumps, score_case, summarise_output  # noqa: E402
from judge import judge_faithfulness  # noqa: E402

DATASET = HERE / "golden_dataset_v1.json"


def load_cases(only: str | None) -> tuple[dict, list[dict]]:
    ds = json.loads(DATASET.read_text(encoding="utf-8"))
    cases = ds["cases"]
    if only:
        ids = set(only.split(","))
        cases = [c for c in cases if c["id"] in ids]
    return ds, cases


def read_jsonl(path: Path) -> dict:
    if not path.exists():
        return {}
    rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    return {r["case_id"]: r for r in rows}


def run_agent(run: str, cases: list[dict], dataset_version: str):
    out_dir = HERE / "results" / run
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "runs.jsonl"
    done = read_jsonl(path)
    harness.install()
    for case in cases:
        if case["id"] in done:
            continue
        print(f"[{run}] {case['id']} {case['input'][:60]!r} ...", flush=True)
        r = harness.run_case(case)
        prompt_version = next((x.get("prompt_version") for x in
                               ([r["output"]] + (r["output"].get("results") or [])) if x.get("prompt_version")), None)
        row = {"case_id": case["id"], "run_name": run, "dataset_version": dataset_version,
               "prompt_version": prompt_version, **r}
        with open(path, "a", encoding="utf-8") as f:
            f.write(dumps(row) + "\n")
        print(f"    -> {summarise_output(r['output'])[:110]} | {r['latency_s']}s "
              f"(+{r['rate_limit_wait_s']}s queue) {r['llm_calls']} llm", flush=True)
        try:
            import langsmith_upload
            langsmith_upload.maybe_upload(case, row)
        except Exception as e:
            print(f"    (LangSmith upload skipped: {e})")
    print(f"replay cache: {harness.replay_get.hits} hits, {harness.replay_get.misses} live fetches")


def pct(xs, p):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return round(xs[lo] + (xs[hi] - xs[lo]) * (k - lo), 5)


def rate(rows, key):
    vals = [r["scores"][key] for r in rows if r["scores"][key] is not None]
    return {"pass": sum(bool(v) for v in vals), "n": len(vals),
            "rate": round(sum(bool(v) for v in vals) / len(vals), 3) if vals else None}


def score(run: str, cases: list[dict]):
    out_dir = HERE / "results" / run
    runs = read_jsonl(out_dir / "runs.jsonl")
    scored_path = out_dir / "scored.jsonl"
    scored = read_jsonl(scored_path)
    for case in cases:
        if case["id"] in scored or case["id"] not in runs:
            continue
        r = runs[case["id"]]
        faith = judge_faithfulness(r["output"], r["llm_io"])
        s = score_case(case, r, faith)
        row = {"case_id": case["id"], "scenario": case["scenario"], "tag": case["tag"], "input": case["input"],
               "fixture": case["fixture"], "expected": case["expected"], "run_name": run,
               "prompt_version": r.get("prompt_version"), "output_summary": summarise_output(r["output"]),
               "latency_s": r["latency_s"], "wall_s": r["wall_s"], "rate_limit_wait_s": r["rate_limit_wait_s"],
               "llm_calls": r["llm_calls"], "tool_calls": r["tool_calls"],
               "prompt_tokens": r["prompt_tokens"], "completion_tokens": r["completion_tokens"],
               "scores": s, "faithfulness": faith}
        with open(scored_path, "a", encoding="utf-8") as f:
            f.write(dumps(row) + "\n")
        print(f"[{run}] scored {case['id']}: success={s['task_success']} faithful={s['faithful']} "
              f"cit={s['citations_verified']}/{s['citations_total']} policy={s['policy_failures']}", flush=True)

    rows = [r for r in read_jsonl(scored_path).values() if r["case_id"] in {c["id"] for c in cases}]
    lat = [r["latency_s"] for r in rows]
    answered = [r for r in rows if r["scores"]["faith_supported"] is not None]
    summary = {
        "run": run, "cases": len(rows),
        "task_success": rate(rows, "task_success"),
        "M1_handling_correct": rate(rows, "handling_correct"),
        "M2_citation_integrity": rate(rows, "citation_integrity"),
        "M2_citation_point_rate": round(sum(r["scores"]["citations_verified"] or 0 for r in rows)
                                        / max(sum(r["scores"]["citations_total"] or 0 for r in rows), 1), 3),
        "M3_faithful_cases": rate(rows, "faithful"),
        "M3_faithful_claim_rate": round(sum(r["scores"]["faith_supported"] or 0 for r in answered)
                                        / max(sum(r["scores"]["faith_total"] or 0 for r in answered), 1), 3),
        "M4_policy_compliance": rate(rows, "policy_compliance"),
        "M5_latency_p50_s": pct(lat, 0.5), "M5_latency_p95_s": pct(lat, 0.95),
        "M5_latency_max_s": max(lat) if lat else None,
        "M5_cost_per_question_usd_mean": round(statistics.mean(r["scores"]["cost_usd"] for r in rows), 5) if rows else None,
        "M5_cost_per_question_usd_p95": pct([r["scores"]["cost_usd"] for r in rows], 0.95),
        "tokens_per_question_mean": round(statistics.mean(r["prompt_tokens"] + r["completion_tokens"] for r in rows)) if rows else None,
        "llm_calls_per_question_mean": round(statistics.mean(r["llm_calls"] for r in rows), 2) if rows else None,
        "errors": sum(1 for r in rows if str(r["output_summary"]).startswith("ERROR")),
        "by_scenario": {sc: rate([r for r in rows if r["scenario"] == sc], "task_success")
                        for sc in ("happy", "edge", "known_failure", "adversarial")},
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--cases")
    ap.add_argument("--score", action="store_true")
    a = ap.parse_args()
    ds, cases = load_cases(a.cases)
    t = time.time()
    if a.score:
        score(a.run, cases)
    else:
        run_agent(a.run, cases, ds["version"])
    print(f"done in {time.time() - t:.0f}s")
