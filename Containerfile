# Docker Official Python 3.12.16 slim Bookworm, Linux amd64 digest inspected
# 2026-11-20. Refresh only after upstream supply-chain and security review.
FROM docker.io/library/python:3.12.16-slim-bookworm@sha256:0f086103b026048cc50cb5da25ec435c023c5241a83fc44daea593377abc61c4

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    GC_NOTEBOOK_DB=/data/notes.sqlite3 \
    GC_NOTEBOOK_ORIGINS=http://127.0.0.1:5173,http://localhost:5173

WORKDIR /opt/goreecloud/notebook
COPY server/requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir --requirement requirements.txt \
    && groupadd --system --gid 10001 notebook \
    && useradd --system --uid 10001 --gid notebook --home-dir /data --shell /usr/sbin/nologin notebook \
    && install -d -m 0700 -o notebook -g notebook /data
COPY --chown=notebook:notebook server/notebook/ ./notebook/
USER 10001:10001
EXPOSE 8000
# 0.0.0.0 here is container-internal. Only publish host loopback.
CMD ["python","-m","uvicorn","notebook.main:app","--host","0.0.0.0","--port","8000","--no-access-log"]
