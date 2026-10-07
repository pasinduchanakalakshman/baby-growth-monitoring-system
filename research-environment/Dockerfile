FROM python:3.10-slim

WORKDIR /workspace

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

CMD ["echo", "Research environment ready"]
