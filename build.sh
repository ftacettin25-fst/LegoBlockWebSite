#!/usr/bin/env bash
# Exit on error
set -e

echo "Building Grids2Bricks React SPA Frontend..."
cd grids2bricks-hub
npm install
npm run build
cd ..

echo "Installing Python Backend Requirements..."
pip install -r requirements.txt

echo "Build complete! Static files are in grids2bricks-hub/dist and ready for Flask."
