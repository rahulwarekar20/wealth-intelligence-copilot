# Week 4 evaluation: Wealth Intelligence Copilot

Evaluation harness, golden dataset and results for the copilot chat agent
(`POST /decisions/ask`). The full write-up is in
[docs/Week 4 Evaluation Report.md](../docs/Week%204%20Evaluation%20Report.md).

| File | What it is |
|---|---|
| [golden_dataset_v1.json](golden_dataset_v1.json) | 42 labelled cases (20 happy, 12 edge, 6 known-failure, 4 adversarial), frozen as `v1` and used for both runs |
| [Week4_WIC_Eval_Results.xlsx](Week4_WIC_Eval_Results.xlsx) | Results workbook: summary with deltas, case-level results (baseline vs improved), rubric, every judge label, judge calibration, every trace span |
| [harness.py](harness.py) | Runs the real agent pipeline with in-memory fixtures in place of PostgreSQL, records one trace per case (child spans for every LLM and tool call), and replays SEC and Finnhub data so both runs see identical inputs |
| [evaluators.py](evaluators.py) | Code-based metrics: correct handling, citation integrity, policy compliance, latency, cost |
| [judge.py](judge.py) | LLM-as-judge for faithfulness (prompt `faith-v1`, model `qwen/qwen3.8-27b`) |
| [judge_calibration.csv](judge_calibration.csv) | Judge vs human labels on 30 claims (96.7% agreement, κ = 0.93) |
| [run_eval.py](run_eval.py) | Runs and scores a named run |
| [make_spreadsheet.py](make_spreadsheet.py) | Builds the results workbook |
| [langsmith_upload.py](langsmith_upload.py) | Optional mirror of each trace to LangSmith when `LANGSMITH_API_KEY` is set (not used for this submission) |
| `results/<run>/` | `runs.jsonl` (outputs and full traces), `scored.jsonl` (per-case scores and judge labels), `summary.json` |

## Re-running

The eval needs the backend's `.env` (Groq, Finnhub, SEC user agent) but no
database. From this folder:

    ..\backend\venv\Scripts\python run_eval.py --run baseline           # agent runs
    ..\backend\venv\Scripts\python run_eval.py --run baseline --score   # judge + scores
    ..\backend\venv\Scripts\python make_spreadsheet.py baseline improved

Runs resume where they stopped, and `--cases H01,E03` runs a subset. The
external-data snapshot lives in `.cache/` (git-ignored). A fresh clone fetches
live data, so its absolute scores can differ slightly from the ones reported here.

Everything runs on Groq's free tier: no paid API is called.
