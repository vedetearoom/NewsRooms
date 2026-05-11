ARG PYTHON_BASE_IMAGE=python:3.13-slim

FROM ${PYTHON_BASE_IMAGE}

ARG APT_MIRROR_HOST=deb.debian.org
ARG PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_TRUSTED_HOST=

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
ENV PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}

WORKDIR /workspace

RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
  sed -i "s|http://deb.debian.org/debian|https://${APT_MIRROR_HOST}/debian|g; s|http://security.debian.org/debian-security|https://${APT_MIRROR_HOST}/debian-security|g" /etc/apt/sources.list.d/debian.sources; \
  fi \
  && if [ -f /etc/apt/sources.list ]; then \
  sed -i "s|http://deb.debian.org/debian|https://${APT_MIRROR_HOST}/debian|g; s|http://security.debian.org/debian-security|https://${APT_MIRROR_HOST}/debian-security|g" /etc/apt/sources.list; \
  fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
  && rm -rf /var/lib/apt/lists/*

RUN pip install \
    beautifulsoup4 \
    requests

CMD ["bash"]
