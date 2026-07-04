#!/usr/bin/env bash
#
# Surface the i18n translation backlog as a single canonical tracking issue.
# Called by .github/workflows/i18n-todo-reminder.yml. Idempotent:
#   - keeps ONE tracking issue labelled `i18n-backlog`
#   - refreshes its body with the current report each run
#   - reopens it + posts a dated comment (the actual reminder ping) while
#     `__TODO__` placeholders remain
#   - closes it once the backlog reaches zero
#
# Requires: gh (authenticated via GH_TOKEN), report.md produced by
# scripts/todo-report.cjs, and TOTAL exported (grand __TODO__ count).
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-CourtHive/courthive-i18n}"
LABEL="i18n-backlog"
TITLE="🌐 i18n translation backlog"
TOTAL="${TOTAL:-0}"
REPORT="$(cat report.md)"

# Ensure the tracking label exists (idempotent; --force updates if present).
gh label create "$LABEL" --repo "$REPO" --color BFD4F2 \
  --description "Untranslated __TODO__ i18n placeholders" --force >/dev/null 2>&1 || true

# Most-recent tracking issue in any state, if one exists.
read -r ISSUE STATE < <(
  gh issue list --repo "$REPO" --label "$LABEL" --state all --limit 1 \
    --json number,state --jq '.[0] | "\(.number // "") \(.state // "")"'
)

build_body() {
  printf '%s\n\n---\n_Maintained automatically by the `i18n-todo-reminder` workflow. Fill the `__TODO__` placeholders in `src/locales/*.json` and open a PR; the count refreshes on the next run and the issue closes at 0._\n_Last checked: %s_\n' \
    "$REPORT" "$(date -u '+%Y-%m-%d %H:%M UTC')"
}

if [ "${TOTAL}" -eq 0 ]; then
  if [ -n "${ISSUE}" ] && [ "${STATE}" = "OPEN" ]; then
    gh issue comment "${ISSUE}" --repo "$REPO" \
      --body "✅ All locales fully translated — no \`__TODO__\` placeholders remain. Closing."
    gh issue close "${ISSUE}" --repo "$REPO"
    echo "Backlog clear; closed issue #${ISSUE}."
  else
    echo "Backlog clear; nothing to surface."
  fi
  exit 0
fi

if [ -z "${ISSUE}" ]; then
  gh issue create --repo "$REPO" --title "$TITLE" --label "$LABEL" --body "$(build_body)"
  echo "Opened new backlog issue."
else
  if [ "${STATE}" = "CLOSED" ]; then
    gh issue reopen "${ISSUE}" --repo "$REPO"
  fi
  gh issue edit "${ISSUE}" --repo "$REPO" --body "$(build_body)"
  gh issue comment "${ISSUE}" --repo "$REPO" \
    --body "🌐 Reminder: **${TOTAL}** untranslated \`__TODO__\` placeholder(s) remain across locales. See the table above; open a translation PR when you get a chance."
  echo "Refreshed issue #${ISSUE}."
fi
