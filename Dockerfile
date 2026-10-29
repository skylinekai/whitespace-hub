# Whitespace Hub: the Node hub (forms, documents, submissions) plus the Python carbon platform at /carbon.
FROM node:22-bookworm-slim AS node

FROM python:3.12-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

WORKDIR /app
COPY package.json ./
RUN SKIP_CARBON_PIP=1 npm install --omit=dev --no-audit --no-fund
COPY carbon/requirements.txt carbon/requirements.txt
RUN pip install --no-cache-dir -r carbon/requirements.txt
COPY . .

ENV NODE_ENV=production \
    CARBON_PREFIX=/carbon \
    CARBON_URL=http://127.0.0.1:5001 \
    PYTHONUNBUFFERED=1
EXPOSE 10000
CMD ["bash", "start.sh"]
