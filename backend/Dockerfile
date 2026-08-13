FROM node:22-bookworm-slim

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      default-jre-headless \
      fonts-noto-cjk \
      libreoffice-calc \
      libreoffice-core \
      libreoffice-impress \
      libreoffice-writer \
      python3 \
    && apt-get clean

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend ./

ENV LIBREOFFICE_BIN=/usr/bin/soffice \
    DATAX_HOME=/app/backend/datax \
    DATAX_BIN=/app/backend/datax/bin/datax.py \
    DATAX_PYTHON=python3

CMD ["node", "src/server.js"]
