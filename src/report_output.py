"""Generate validator_report.md from schedule validation results."""
import sys
from kitchen_data import OPEN_DAYS
from scheduler import run_scheduler
from validator import validate


def generate_report(report: dict, output_path: str):
    lines = []
    lines.append("# Validator Report")
    lines.append(f"Week of: 2026-03-02 (Mon) → 2026-03-08 (Sun)")
    lines.append("")
    lines.append(f"## Validation Status: {report['status']}")
    lines.append("")

    if report["errors"]:
        lines.append("## Errors")
        for e in report["errors"]:
            lines.append(f"- {e}")
        lines.append("")

    if report["warnings"]:
        lines.append("## Warnings")
        for w in report["warnings"]:
            lines.append(f"- {w}")
        lines.append("")

    lines.append("## Assumptions")
    for a in report["assumptions"]:
        lines.append(f"- {a}")
    lines.append("")

    lines.append("## Shift Counts")
    lines.append("| Employee | Shifts |")
    lines.append("|----------|--------|")
    for name, cnt in sorted(report["shift_counts"].items(), key=lambda x: -x[1]):
        lines.append(f"| {name} | {cnt} |")
    lines.append("")

    lines.append("## Fragility Notes")
    lines.append("- ⚠️  TUESDAY STRUCTURAL GAP: Chef off + CDC off all week = only Raimi on Expeditor (1 of 2 needed). No qualified coverage for 2nd expeditor from line staff. Recommend: keep Tuesday covers light; Raimi manages pass solo.")
    lines.append("- CDC absent all week: Raimi is the sole 2nd expeditor on Wed/Thu/Fri/Sat. Any Raimi absence creates a 1-expeditor risk on those days too.")
    lines.append("- Sebastian works all 5 days — he is the only flex backup for Pantry/Stuzz/Pastry. His absence on any day is HIGH risk for cold-side station coverage.")
    lines.append("- Sam trains on Sauté every day alongside Brandon, but counts 0 for Sauté coverage. Brandon must be present for safe Sauté execution.")
    lines.append("- Sauté coverage: Brandon (all 5 days), Raimi (backup). No CDC fallback this week.")
    lines.append("- Fri/Sat PEAK: Floater = Sebastian. If Sebastian is absent, there is no floater and cold-side stations also lose their backup.")
    lines.append("")

    lines.append("## Repair Options (if needed)")
    lines.append("- Tuesday 2nd Expeditor: no fix available with current staffing. Keep service lean on Tuesday.")
    lines.append("- If Raimi is absent mid-week: Chef solo expedites (MID is manageable); peak days become 1-expeditor risk.")
    lines.append("- If Sebastian is absent: Mateo covers Pantry (already default), Echo covers Stuzz, AJ covers Pastry — no Floater available on peak days.")
    lines.append("- If Brandon is absent: Raimi drops from Expeditor to Sauté; Chef solo expedites; no 2nd Expeditor. High risk on peak days.")
    lines.append("- If Sam is absent: Kate covers Pasta (Tue/Wed/Thu) or Chris covers Pasta (Fri/Sat) — note Chris has no Pasta capability, so Fri/Sat Pasta would need Kate or Raimi.")
    lines.append("- Emergency PM floater: Natalia (overtime risk, emergency only).")
    lines.append("")

    with open(output_path, "w") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    assignments, shift_counts = run_scheduler()
    report = validate(assignments, shift_counts)
    out = sys.argv[1] if len(sys.argv) > 1 else "validator_report.md"
    generate_report(report, out)
    print(f"Report generated → {out}")
