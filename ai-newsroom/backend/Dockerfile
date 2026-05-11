ARG PYTHON_BASE_IMAGE=docker.m.daocloud.io/library/python:3.13-slim
ARG DOCKER_CLI_IMAGE=docker.m.daocloud.io/library/docker:cli

FROM ${DOCKER_CLI_IMAGE} AS docker-cli

FROM ${PYTHON_BASE_IMAGE}

ARG APT_MIRROR_HOST=mirrors.aliyun.com
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ARG PIP_TRUSTED_HOST=mirrors.aliyun.com
ARG PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000
ARG PLAYWRIGHT_DOWNLOAD_HOST=

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
ENV PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}
ENV PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=${PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT}
ENV PLAYWRIGHT_DOWNLOAD_HOST=${PLAYWRIGHT_DOWNLOAD_HOST}

WORKDIR /app

RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
  sed -i "s|http://deb.debian.org/debian|https://${APT_MIRROR_HOST}/debian|g; s|http://security.debian.org/debian-security|https://${APT_MIRROR_HOST}/debian-security|g" /etc/apt/sources.list.d/debian.sources; \
  fi \
  && if [ -f /etc/apt/sources.list ]; then \
  sed -i "s|http://deb.debian.org/debian|https://${APT_MIRROR_HOST}/debian|g; s|http://security.debian.org/debian-security|https://${APT_MIRROR_HOST}/debian-security|g" /etc/apt/sources.list; \
  fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt

RUN pip install --upgrade pip \
  && pip install -r /tmp/requirements.txt \
  && python -m playwright install --with-deps chromium

# Copy Docker CLI tools for Docker-out-of-Docker (DooD) support
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/

COPY . /app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
