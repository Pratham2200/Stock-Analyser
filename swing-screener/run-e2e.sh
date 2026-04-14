#!/bin/bash
lsof -i :4000 -t | xargs kill -9 2>/dev/null || true

npx ts-node main.ts > server.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID $SERVER_PID. Waiting for Yahoo Finance to be ready..."

# Wait until "Yahoo Finance browser ready!" appears in server.log
timeout 60 bash -c 'until grep -q "Yahoo Finance browser ready" server.log; do sleep 1; done'

echo "Server is fully ready. Running e2e test suite..."
npx vitest run tests/e2e-phases.test.ts
TEST_EXIT_CODE=$?

echo "Tests finished with exit code $TEST_EXIT_CODE. Killing server $SERVER_PID"
kill -9 $SERVER_PID 2>/dev/null || true
exit $TEST_EXIT_CODE
