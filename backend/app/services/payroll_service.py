# TODO: implement in Phase 3
#
# Salary computation engine rules (from CLAUDE.md):
#   - Employee types: FULL_TIME (fixed monthly), HOURLY (attendance-linked), CONTRACT (milestone/daily)
#   - Deduction rules stored in deduction_rules config table (not hardcoded)
#   - Payroll states: DRAFT -> APPROVED -> PROCESSED -> PAID
#   - Never overwrite a processed run — create a new revision
