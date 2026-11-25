#!/usr/bin/env python3
"""Fail unless every AppInspect JSON report given has no failures, errors, warnings, manual checks or skips.

    python3 .github/scripts/appinspect_gate.py appinspect-*.json
"""
import json
import sys

bad = 0
for path in sys.argv[1:]:
    with open(path, encoding='utf-8') as f:
        report = json.load(f)
    summary = report['summary']
    problems = {k: summary.get(k, 0) for k in ('failure', 'error', 'warning', 'manual_check', 'skipped', 'future_failure') if summary.get(k, 0)}
    print(f"{path}: {summary.get('success', 0)} passed, {summary.get('not_applicable', 0)} not applicable" + (f', PROBLEMS {problems}' if problems else ''))
    if problems:
        bad += 1
        for app in report.get('reports', []):
            for group in app.get('groups', []):
                for check in group.get('checks', []):
                    if check.get('result') not in ('success', 'not_applicable'):
                        for m in check.get('messages', []) or [{}]:
                            print(f"  {check.get('result')}: {check.get('name')}: {m.get('message', '')}")
if not sys.argv[1:]:
    sys.exit('no reports given')
sys.exit(1 if bad else 0)
