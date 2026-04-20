#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Installing frontend dependencies and building..."
cd frontend
npm install
npm run build
cd ..

echo "Installing backend dependencies..."
pip install -r backend/requirements.txt