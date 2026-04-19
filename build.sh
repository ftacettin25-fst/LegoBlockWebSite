#!/usr/bin/env bash
# Exit on error
set -e

echo "Building Grids2Bricks React Frontend..."
cd grids2bricks-hub
npm install
npm run build
cd ..

echo "Installing Python Backend Requirements..."
pip install -r requirements.txt
