#!/bin/bash
set -e
echo "Stopping test infrastructure..."
docker compose -f docker/docker-compose.test.yml down -v 2>/dev/null || true
echo "Test infrastructure stopped"
