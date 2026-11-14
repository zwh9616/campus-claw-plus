FROM python@sha256:5862d971d1f0ae26b258cefa4e893556b1d3aba81bd2ff30888704ad378bab67 AS dependencies
WORKDIR /build
COPY requirements.lock .
RUN python -m pip install --no-cache-dir --require-hashes --no-deps --target=/packages -r requirements.lock

FROM python@sha256:5862d971d1f0ae26b258cefa4e893556b1d3aba81bd2ff30888704ad378bab67
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN rm -rf /usr/local/lib/python3.14/ensurepip \
    /usr/local/lib/python3.14/site-packages/pip \
    /usr/local/lib/python3.14/site-packages/pip-*.dist-info /usr/local/bin/pip*
COPY --from=dependencies /packages /usr/local/lib/python3.14/site-packages
COPY core.py runner.py worker.py server.py /app/
USER 65532:65532
ENTRYPOINT ["python", "-B", "-I", "/app/runner.py"]
