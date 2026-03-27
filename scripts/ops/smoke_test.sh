#!/bin/bash
# =============================================================================
# Smoke Test — yieldlab-app
# 最低限のヘルスチェック。CI 用に拡充すること。
# =============================================================================

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/volume1/docker/yieldlab-app}"
PASS=0
FAIL=0

log()  { echo "[SMOKE][yieldlab-app] $*"; }
check_pass() { log "PASS: $1"; PASS=$(( PASS + 1 )); }
check_fail() { log "FAIL: $1"; FAIL=$(( FAIL + 1 )); }

# --- backend 構文チェック ---
if [[ -f "$PROJECT_DIR/backend/main.py" ]]; then
    if python3 -m py_compile "$PROJECT_DIR/backend/main.py" 2>/dev/null; then
        check_pass "backend/main.py 構文OK"
    else
        check_fail "backend/main.py 構文エラー"
    fi
fi

# --- frontend ビルドチェック（package.json があれば型チェックのみ） ---
if [[ -f "$PROJECT_DIR/package.json" ]]; then
    if command -v node &>/dev/null && [[ -f "$PROJECT_DIR/tsconfig.json" ]]; then
        cd "$PROJECT_DIR"
        if node -e "require('./tsconfig.json')" 2>/dev/null; then
            check_pass "tsconfig.json 読み込みOK"
        else
            check_fail "tsconfig.json 読み込み失敗"
        fi
    fi
fi

TOTAL=$(( PASS + FAIL ))
echo "---"
echo "PASS $PASS"
echo "FAIL $FAIL"
echo "$TOTAL 項目"

[[ $FAIL -eq 0 ]]
