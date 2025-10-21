import socket
import os
import mimetypes
from urllib.parse import unquote
import threading
import time

HOST = '0.0.0.0'
PORT = 8080
ROOT_DIR = "./src"

# Shared counters
request_counts_naive = {}
request_counts_safe = {}
request_counts_lock = threading.Lock()

def generate_directory_listing(fs_dir_path, request_path):
    items = os.listdir(fs_dir_path)
    html = f"<html><body><h2>Directory listing for {request_path}</h2><ul>"

    # Parent directory link
    if request_path != "/":
        parent_path = os.path.dirname(request_path.rstrip('/'))
        html += f'<li><a href="{parent_path or "/"}">.. (parent directory)</a></li>'

    for item in items:
        item_fs_path = os.path.join(fs_dir_path, item)
        # URL path for links
        item_url_path = os.path.join(request_path, item).replace("\\", "/")

        naive_count = request_counts_naive.get(item_fs_path, 0)
        safe_count = request_counts_safe.get(item_fs_path, 0)
        html += f'<li><a href="{item_url_path}">{item}</a> (naive: {naive_count}, safe: {safe_count})</li>'

    html += '<li><a href="missing_file.html">Click to test 404 error</a></li>'
    html += "</ul></body></html>"
    return html.encode()

def handle_request(conn):
    try:
        request = conn.recv(1024).decode()
        if not request:
            return
        lines = request.splitlines()
        if len(lines) == 0:
            return
        request_line = lines[0]
        parts = request_line.split()
        if len(parts) < 2:
            return
        method, path = parts[0], parts[1]
        path = unquote(path)
        fs_path = os.path.join(ROOT_DIR, path.lstrip("/"))

        time.sleep(0.5)

        if os.path.exists(fs_path):
            # Naive (race-prone)
            if fs_path not in request_counts_naive:
                request_counts_naive[fs_path] = 0
            temp = request_counts_naive[fs_path]
            time.sleep(0.01)  # force race condition
            request_counts_naive[fs_path] = temp + 1

            # Safe (synchronized)
            with request_counts_lock:
                if fs_path not in request_counts_safe:
                    request_counts_safe[fs_path] = 0
                request_counts_safe[fs_path] += 1

        # Serve directories
        if os.path.isdir(fs_path):
            content = generate_directory_listing(fs_path, path)
            header = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n"
            conn.sendall(header.encode() + content)
            return

        # Serve files
        if not os.path.isfile(fs_path):
            header = "HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\n\r\n"
            body = f"<html><body><h1>404 Not Found</h1><p>{path} not found.</p></body></html>"
            conn.sendall(header.encode() + body.encode())
            return

        mime_type, _ = mimetypes.guess_type(fs_path)
        if mime_type is None:
            mime_type = "application/octet-stream"

        with open(fs_path, "rb") as f:
            content = f.read()

        header = f"HTTP/1.1 200 OK\r\nContent-Type: {mime_type}\r\nContent-Length: {len(content)}\r\n\r\n"
        conn.sendall(header.encode() + content)

    except Exception as e:
        print("Error handling request:", e)
    finally:
        conn.close()

def main():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, PORT))
        s.listen(5)
        print(f"Serving HTTP on {HOST}:{PORT} from {ROOT_DIR}")

        while True:
            conn, addr = s.accept()
            threading.Thread(target=handle_request, args=(conn,), daemon=True).start()

if __name__ == "__main__":
    main()

