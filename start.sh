#!/bin/bash
cd "$(dirname "$0")"
echo "=== Bandarmologger ==="
echo "Installing dependencies..."
npm install --silent 2>/dev/null
echo "Starting server..."
echo ""
node server/index.js
