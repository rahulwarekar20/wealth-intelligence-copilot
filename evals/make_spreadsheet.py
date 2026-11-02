"""
Builds evals/Week4_WIC_Eval_Results.xlsx from the scored runs:

  Summary       metric, pass bar, baseline, improved, delta
  Cases         one row per golden case: input, expected behaviour, baseline
                output + PASS/FAIL + failure category, improved output + PASS/FAIL
  Rubric        how each metric is scored
  Judge labels  every claim the faithfulness judge labelled (both runs)
  Calibration   judge vs human labels on a sample of claims
  Traces        every LLM / tool span per case (both runs)

    ..\\backend\\venv\\Scripts\\python make_spreadsheet.py [baseline_run] [improved_run]
"""
import csv
import json
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

HERE = Path(__file__).resolve().parent
BASE = sys.argv[1] if len(sys.argv) > 1 else "baseline"
IMPR = sys.argv[2] if len(sys.argv) > 2 else "improved"

GREEN = PatternFill("solid", fgColor="D9F2E3")
RED = PatternFill("solid", fgColor="F8D7DA")
HEAD = PatternFill("solid", fgColor="262626")


def jl(path: Path) -> dict:
    if not path.exists():
        return {}
    return {r["case_id"]: r for r in (json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip())}


def summary(run):
    p = HERE / "results" / run / "summary.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def failure_category(s: dict) -> str:
    """Comma-separated failure categories for a scored case (empty when it passed)."""
    if not s:
        return ""
    sc = s["scores"]
    cats = []
    if str(s.get("output_summary", "")).startswith("ERROR"):
        cats.append("agent error")
    if not sc["handling_correct"]:
        cats.append("routing / ticker resolution")
    if sc["citation_integrity"] is False:
        cats.append("unverified citation")
    if sc["faithful"] is False:
        cats.append("unsupported claim")
    for f in sc["policy_failures"]:
        cats.append("policy: " + f.split(" [")[0].split(" {")[0][:60])
    if not sc["latency_ok"]:
        cats.append("latency > 120s")
    return "; ".join(cats)


def expected_text(e: dict) -> str:
    route = "/".join(e.get("route_any_of") or [e.get("route", "")])
    tick = e.get("tickers") or e.get("tickers_any_of") or (
        f"3 of {e['tickers_subset_of']}" if e.get("tickers_subset_of") else [])
    checks = "; ".join(f"{k}={v}" for k, v in (e.get("checks") or {}).items())
    return f"route={route}; tickers={tick}" + (f"; {checks}" if checks else "")


def style_header(ws, ncols):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=1, column=c)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = HEAD
        cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "B2"


def widths(ws, ws_widths):
    for i, w in enumerate(ws_widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")


def fmt_rate(r):
    if not r or r.get("rate") is None:
        return "n/a"
    return f"{r['rate']:.0%} ({r['pass']}/{r['n']})"


def main():
    ds = json.loads((HERE / "golden_dataset_v1.json").read_text(encoding="utf-8"))
    b_sc, i_sc = jl(HERE / "results" / BASE / "scored.jsonl"), jl(HERE / "results" / IMPR / "scored.jsonl")
    b_run, i_run = jl(HERE / "results" / BASE / "runs.jsonl"), jl(HERE / "results" / IMPR / "runs.jsonl")
    bs, is_ = summary(BASE), summary(IMPR)
    wb = Workbook()

    # ── Summary ──
    ws = wb.active
    ws.title = "Summary"
    ws.append(["Metric", "Judge method", "Pass bar", f"Baseline ({BASE})", f"Improved ({IMPR})", "Delta", "Meets bar (improved)"])
    rows = [
        ("Task success (all applicable metrics pass)", "composite", ">= 80%", "task_success", 0.80),
        ("M1 Correct handling (route + tickers)", "code, exact match", ">= 95%", "M1_handling_correct", 0.95),
        ("M2 Citation integrity (answers with every citation verified)", "code", ">= 90%", "M2_citation_integrity", 0.90),
        ("M3 Faithfulness (answers with every claim supported)", "LLM-as-judge (qwen3.8-27b)", ">= 80%", "M3_faithful_cases", 0.80),
        ("M4 Policy / guardrail compliance", "code, labelled checks", "100%", "M4_policy_compliance", 1.0),
    ]
    for name, method, bar, key, thr in rows:
        b, i = bs.get(key), is_.get(key)
        d = (i["rate"] - b["rate"]) if b and i and b.get("rate") is not None and i.get("rate") is not None else None
        ws.append([name, method, bar, fmt_rate(b), fmt_rate(i), "" if d is None else f"{d * 100:+.0f} pp",
                   "" if not i or i.get("rate") is None else ("YES" if i["rate"] >= thr else "NO")])
    scalar = [
        ("M2 Citation point rate (verified / cited points)", "code", ">= 97%", "M2_citation_point_rate", 0.97, "pct", True),
        ("M3 Faithful claim rate (supported / judged claims)", "LLM-as-judge", ">= 95%", "M3_faithful_claim_rate", 0.95, "pct", True),
        ("M5 Latency p50 (s, excl. provider queueing)", "code", "<= 15 s", "M5_latency_p50_s", 15, "num", False),
        ("M5 Latency p95 (s, excl. provider queueing)", "code", "<= 120 s (Week 3: under 2 min)", "M5_latency_p95_s", 120, "num", False),
        ("M5 Cost per question, mean (USD, Groq list price)", "code (tokens x price)", "<= $0.005", "M5_cost_per_question_usd_mean", 0.005, "usd", False),
        ("Tokens per question, mean", "code", "info", "tokens_per_question_mean", None, "num", False),
        ("LLM calls per question, mean", "code", "info", "llm_calls_per_question_mean", None, "num", False),
        ("Agent errors (count)", "code", "0", "errors", 0, "num", False),
    ]
    for name, method, bar, key, thr, kind, higher in scalar:
        b, i = bs.get(key), is_.get(key)
        f = (lambda v: f"{v:.1%}") if kind == "pct" else (lambda v: f"${v:.5f}") if kind == "usd" else (lambda v: f"{v}")
        d = "" if b is None or i is None else (f"{(i - b) * 100:+.1f} pp" if kind == "pct" else f"{i - b:+.5f}" if kind == "usd" else f"{i - b:+.2f}")
        meets = "" if thr is None or i is None else ("YES" if (i >= thr if higher else i <= thr) else "NO")
        ws.append([name, method, bar, "n/a" if b is None else f(b), "n/a" if i is None else f(i), d, meets])
    ws.append([])
    ws.append(["Task success by scenario"])
    for sc in ("happy", "edge", "known_failure", "adversarial"):
        b, i = (bs.get("by_scenario") or {}).get(sc), (is_.get("by_scenario") or {}).get(sc)
        ws.append([f"  {sc}", "", "", fmt_rate(b), fmt_rate(i)])
    ws.append([])
    ws.append(["Dataset", f"{ds['name']} {ds['version']} ({len(ds['cases'])} cases), identical for both runs; external data replayed from the same snapshot."])
    ws.append(["Faithfulness note", "The 4 comparison cases (H05, H13, E08, E09) were not judged in either run: the judge model's free daily token quota (200k/day) ran out. M3 covers single-stock answers in both runs; comparisons are scored on every other metric."])
    ws.append(["Cost note", "The eval ran on Groq's free tier (actual spend $0). Cost is the list-price equivalent for production planning."])
    style_header(ws, 7)
    widths(ws, [52, 26, 26, 22, 22, 10, 12])
    for row in ws.iter_rows(min_row=2, max_col=7):
        if row[6].value == "YES":
            row[6].fill = GREEN
        elif row[6].value == "NO":
            row[6].fill = RED

    # ── Cases ──
    ws = wb.create_sheet("Cases")
    hdr = ["Case ID", "Scenario", "Tag", "Investor fixture", "Input (question)", "Chat history", "Expected behaviour",
           "Label note", "Baseline output", "Baseline PASS/FAIL", "Baseline failure category",
           "Baseline citations", "Baseline faithful claims", "Baseline latency s", "Baseline prompt version",
           "Improved output", "Improved PASS/FAIL", "Improved failure category", "Improved citations",
           "Improved faithful claims", "Improved latency s", "Improved prompt version", "Change"]
    ws.append(hdr)
    for c in ds["cases"]:
        b, i = b_sc.get(c["id"]), i_sc.get(c["id"])

        def cols(s):
            if not s:
                return ["(not run)", "", "", "", "", "", ""]
            sc = s["scores"]
            return [s["output_summary"], "PASS" if sc["task_success"] else "FAIL", failure_category(s),
                    "" if sc["citations_total"] is None else f"{sc['citations_verified']}/{sc['citations_total']}",
                    "" if sc["faith_total"] is None else f"{sc['faith_supported']}/{sc['faith_total']}",
                    s["latency_s"], s.get("prompt_version") or ""]
        bc, ic = cols(b), cols(i)
        change = ""
        if b and i:
            bp, ip = b["scores"]["task_success"], i["scores"]["task_success"]
            change = "fixed" if ip and not bp else "REGRESSED" if bp and not ip else "same"
        hist = " | ".join(f"{h['role']}: {h['content']}" for h in c.get("history") or [])
        ws.append([c["id"], c["scenario"], c["tag"], c["fixture"], c["input"], hist, expected_text(c["expected"]),
                   c.get("label_note", "")] + bc + ic + [change])
    style_header(ws, len(hdr))
    widths(ws, [8, 12, 16, 12, 40, 30, 40, 40, 55, 10, 30, 10, 10, 9, 9, 55, 10, 30, 10, 10, 9, 9, 10])
    for row in ws.iter_rows(min_row=2):
        for idx in (9, 16):
            cell = row[idx]
            cell.fill = GREEN if cell.value == "PASS" else RED if cell.value == "FAIL" else PatternFill()

    # ── Rubric ──
    ws = wb.create_sheet("Rubric")
    ws.append(["Metric", "User outcome it maps to", "Judge method", "Scoring rule", "Applies to", "Pass bar"])
    for r in [
        ("M1 Correct handling", "The investor gets an answer about the stock they meant (or is asked to clarify)",
         "Code, exact match", "PASS if route equals the labelled route AND the set of analysed tickers equals the labelled set "
         "(tickers_any_of / tickers_subset_of+count where several answers are valid)", "All cases", ">= 95%"),
        ("M2 Citation integrity", "Every cited point is traceable to a source (Week 3 metric)",
         "Code", "PASS if the answer has >=1 cited point and verified == cited, using the app's per-specialist "
         "citation check against the sources actually retrieved", "Answered cases", ">= 90% of answers; >= 97% of points"),
        ("M3 Faithfulness", "Figures and facts the investor acts on are real",
         "LLM-as-judge: qwen/qwen3.8-27b on Groq, temperature 0, prompt faith-v1 (judge.py)",
         "Each claim (answer, key points, positives, risks, comparison verdict) labelled SUPPORTED / NOT_SUPPORTED / "
         "CONTRADICTED against the retrieved data; case PASS only if all claims SUPPORTED", "Answered cases",
         ">= 80% of answers; >= 95% of claims"),
        ("M4 Policy compliance", "Advice fits the investor's limits and the agent's never-do rules",
         "Code, labelled checks per case", "Every check in expected.checks must hold (action_not_in, max_confidence, "
         "mentions_any, not_mentions, key_points_cite_any, has_risks, answer_has_number, preferred_in)",
         "All cases (most have no checks = PASS)", "100%"),
        ("M5 Latency", "Question to decision in under 2 minutes (Week 3 target)", "Code (trace timing)",
         "Wall-clock time of answer_question minus time spent waiting on Groq free-tier 429s", "All cases",
         "p95 <= 120 s; p50 <= 15 s"),
        ("M5 Cost", "Affordable to run per question", "Code (tokens x Groq list price)",
         "gpt-oss-20b $0.075 / $0.30 and gpt-oss-120b $0.15 / $0.60 per 1M input / output tokens", "All cases", "<= $0.005"),
        ("Task success", "'A decision they would act on, 8 times out of 10' (Week 3)", "Composite",
         "PASS if M1, M4 and latency pass and, for answered cases, M2 and M3 pass", "All cases", ">= 80%"),
    ]:
        ws.append(list(r))
    style_header(ws, 6)
    widths(ws, [22, 40, 30, 70, 22, 22])

    # ── Judge labels ──
    ws = wb.create_sheet("Judge labels")
    ws.append(["Run", "Case ID", "#", "Claim", "Judge label", "Judge reason"])
    for run, sc in ((BASE, b_sc), (IMPR, i_sc)):
        for cid, s in sc.items():
            for l in (s.get("faithfulness") or {}).get("labels") or []:
                ws.append([run, cid, l["n"], l["claim"], l["label"], l["reason"]])
    style_header(ws, 6)
    widths(ws, [10, 8, 4, 80, 16, 50])

    # ── Calibration ──
    cal = HERE / "judge_calibration.csv"
    if cal.exists():
        ws = wb.create_sheet("Judge calibration")
        with open(cal, encoding="utf-8") as f:
            for row in csv.reader(f):
                ws.append(row)
        style_header(ws, ws.max_column)
        widths(ws, [10, 8, 4, 70, 16, 16, 10, 60])

    # ── Traces ──
    ws = wb.create_sheet("Traces")
    ws.append(["Run", "Case ID", "Prompt version", "Span #", "Type", "Name", "Model", "Latency s",
               "Rate-limit wait s", "Prompt tokens", "Completion tokens", "Reasoning tokens", "Status", "Error", "Args"])
    for run, rr in ((BASE, b_run), (IMPR, i_run)):
        for cid, r in rr.items():
            t0 = r["spans"][0]["start"] if r["spans"] else 0
            for n, s in enumerate(r["spans"], 1):
                ws.append([run, cid, r.get("prompt_version"), n, s["type"], s["name"], s.get("model"), s["latency_s"],
                           s.get("rate_limit_wait_s"), s.get("prompt_tokens"), s.get("completion_tokens"),
                           s.get("reasoning_tokens"), s.get("status"), s.get("error"), ", ".join(s.get("args") or [])])
    style_header(ws, 15)
    widths(ws, [10, 8, 8, 6, 6, 30, 20, 9, 9, 9, 9, 9, 7, 40, 12])

    out = HERE / "Week4_WIC_Eval_Results.xlsx"
    wb.save(out)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
