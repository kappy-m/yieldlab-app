#!/bin/bash
cd /volume1/docker/yieldlab-app
git add backend/services/rakuten_rating_fetcher.py
git commit -m "fix: レビューテキストのURL・継続文字列を完全除去" 2>&1
git push origin main 2>&1
echo "done"
