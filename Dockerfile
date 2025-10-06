FROM python:3.9-slim

WORKDIR /app

COPY server.py .
COPY client.py .
COPY src ./src

EXPOSE 8080

# Default command is server
CMD ["python", "server.py", "./src"]
