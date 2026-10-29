#!/usr/bin/env bash
# Starts the carbon platform (internal only) and the hub, which serves the site and passes /carbon through.
set -m
cd /app/carbon
gunicorn app:app --workers 2 --threads 4 --timeout 200 --bind 127.0.0.1:5001 &
cd /app
node server.js &
# If either stops, stop the container so Render restarts it.
wait -n
exit $?
