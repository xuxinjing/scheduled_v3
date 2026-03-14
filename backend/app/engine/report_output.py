"""Markdown report generation for validator output."""
from __future__ import annotations


def generate_report(report: dict, week_start: str) -> str:
    lines = [
        "# Validator Report",
        f"Week of: {week_start}",
        "",
        f"## Validation Status: {report['status']}",
        "",
    ]
    if report["errors"]:
        lines.append("## Errors")
        lines.extend(f"- {error}" for error in report["errors"])
        lines.append("")
    if report["warnings"]:
        lines.append("## Warnings")
        lines.extend(f"- {warning}" for warning in report["warnings"])
        lines.append("")
    lines.append("## Assumptions")
    lines.extend(f"- {assumption}" for assumption in report["assumptions"])
    lines.append("")
    lines.append("## Shift Counts")
    lines.append("| Employee | Shifts |")
    lines.append("|----------|--------|")
    for name, count in sorted(report["shift_counts"].items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| {name} | {count} |")
    lines.append("")
    return "\n".join(lines)

