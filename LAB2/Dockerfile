FROM python:3.9-slim

WORKDIR /app

COPY multithread.py .
COPY client.py .
COPY src ./src

EXPOSE 8080

CMD ["python", "multithread.py", "./src"]
