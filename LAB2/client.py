import socket
import sys
import os
from urllib.parse import urlparse

def download(url, save_dir):
    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port or 8080
    path = parsed.path or "/"
    filename = os.path.basename(path)

    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((host, port))
        request = f"GET {path} HTTP/1.1\r\nHost: {host}\r\n\r\n"
        s.sendall(request.encode())

        response = b""
        while True:
            chunk = s.recv(1024)
            if not chunk:
                break
            response += chunk

    header, _, body = response.partition(b"\r\n\r\n")
    headers = header.decode(errors="ignore")

    if "Content-Type: text/html" in headers:
        print(body.decode(errors="ignore"))
    elif "Content-Type: image/png" in headers:
        file_path = os.path.join(save_dir, filename or "download.png")
        with open(file_path, "wb") as f:
            f.write(body)
        print(f"Saved PNG as {file_path}")
    elif "Content-Type: application/pdf" in headers:
        file_path = os.path.join(save_dir, filename or "download.pdf")
        with open(file_path, "wb") as f:
            f.write(body)
        print(f"Saved PDF as {file_path}")
    else:
        print("Unknown content type")
        file_path = os.path.join(save_dir, filename or "download.bin")
        with open(file_path, "wb") as f:
            f.write(body)
        print(f"Saved unknown file as {file_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python client.py <URL> <save_directory>")
        sys.exit(1)

    url = sys.argv[1]
    save_dir = sys.argv[2]

    download(url, save_dir)
