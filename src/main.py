"""Main entry point: preflight → schedule → xlsx + validator report."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from preflight_check import run_preflight
from scheduler import run_scheduler
from validator import validate
from pivot_output import generate_pivot
from report_output import generate_report
from kitchen_data import WEEK_START

OUTPUT_DIR = os.path.dirname(os.path.dirname(__file__))

xlsx_path  = os.path.join(OUTPUT_DIR, "schedule_output.xlsx")
report_path = os.path.join(OUTPUT_DIR, "validator_report.md")

print(f"Acquerello scheduler — week of {WEEK_START}")
print("Running preflight check...")
pf_errors, pf_warnings = run_preflight()
for w in pf_warnings:
    print(f"  ⚠️  {w}")
for e in pf_errors:
    print(f"  ❌  {e}")
if pf_errors:
    print(f"\nPREFLIGHT FAILED — fix {len(pf_errors)} error(s) in week_config.json before scheduling.")
    sys.exit(1)
print(f"  Preflight: PASS ({len(pf_warnings)} warning(s))\n")

print("Running scheduler...")

# Generate pivot-style schedule (rows=employees, columns=days)
generate_pivot(xlsx_path)
print(f"  → {xlsx_path}")

assignments, shift_counts = run_scheduler()
full_report = validate(assignments, shift_counts)
generate_report(full_report, report_path)
print(f"  → {report_path}")

print(f"\nStatus: {full_report['status']}")
print(f"Errors: {len(full_report['errors'])}  |  Warnings: {len(full_report['warnings'])}")
if full_report['errors']:
    print("\nERRORS:")
    for e in full_report['errors']:
        print(f"  {e}")
if full_report['warnings']:
    print("\nWARNINGS:")
    for w in full_report['warnings']:
        print(f"  {w}")
