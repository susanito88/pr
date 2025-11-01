import socket
import os
import mimetypes
from urllib.parse import unquote
import threading
import time

HOST = '0.0.0.0'
PORT = 8081
ROOT_DIR = os.path.abspath("./src")

# Request counters
request_counts_naive = {}
request_counts_safe = {}
request_counts_lock = threading.Lock()

# Rate limiting
RATE_LIMIT = 5
WINDOW_SECONDS = 1
rate_limits = {}        # client_ip -> list of timestamps
rate_lock = threading.Lock()


def generate_directory_listing(fs_dir_path, request_path):

    fs_dir_abspath = os.path.abspath(fs_dir_path)
    items = os.listdir(fs_dir_abspath)
    html = f"<html><body><h2>Directory listing for {request_path}</h2><ul>"

    if request_path != "/":
        parent_path = os.path.dirname(request_path.rstrip('/'))
        if parent_path == "":
            parent_path = "/"
        html += f'<li><a href="{parent_path}">.. (parent directory)</a></li>'

    for item in items:
        item_fs_path = os.path.abspath(os.path.join(fs_dir_abspath, item))
        item_url_path = os.path.join(request_path, item).replace("\\", "/")

        naive_count = request_counts_naive.get(item_fs_path, 0)
        safe_count = request_counts_safe.get(item_fs_path, 0)
        html += f'<li><a href="{item_url_path}">{item}</a> (naive: {naive_count}, safe: {safe_count})</li>'

    html += "</ul></body></html>"
    return html.encode()


def is_rate_limited(client_ip):
    """Return True if client exceeded RATE_LIMIT per WINDOW_SECONDS."""
    current_time = time.time()
    with rate_lock:
        if client_ip not in rate_limits:
            rate_limits[client_ip] = []

        # remove old timestamps
        rate_limits[client_ip] = [ts for ts in rate_limits[client_ip] if current_time - ts < WINDOW_SECONDS]

        if len(rate_limits[client_ip]) >= RATE_LIMIT:
            return True

        # new ts
        rate_limits[client_ip].append(current_time)
        return False


def handle_request(conn, addr):
    client_ip, client_port = addr
    thread_name = threading.current_thread().name
    print(f"[{thread_name} (handle_client)] Request from {addr}: starting")

    try:
        # Check rate limit
        if is_rate_limited(client_ip):
            header = "HTTP/1.1 429 Too Many Requests\r\nContent-Type: text/html\r\n\r\n"
            body = "<h1>429 Too Many Requests</h1><p>Rate limit exceeded.</p>"
            conn.sendall(header.encode() + body.encode())
            print(f"[{thread_name}] Rate limit exceeded for {client_ip}")
            return

        request = conn.recv(1024).decode()
        if not request:
            print(f"[{thread_name}] Empty request from {addr}")
            return

        lines = request.splitlines()
        if len(lines) == 0:
            print(f"[{thread_name}] Malformed request from {addr}")
            return

        request_line = lines[0]
        parts = request_line.split()
        if len(parts) < 2:
            print(f"[{thread_name}] Invalid request line: {request_line}")
            return

        method, path = parts[0], parts[1]
        path = unquote(path)

        fs_path = os.path.abspath(os.path.join(ROOT_DIR, path.lstrip("/")))

        print(f"[{thread_name}] Requested path: {path}")

        time.sleep(0.5)  # simulate work

        # Increment counters if path exists
        if os.path.exists(fs_path):
            # Naive counter (race-prone)
            if fs_path not in request_counts_naive:
                request_counts_naive[fs_path] = 0
            temp = request_counts_naive[fs_path]
            time.sleep(0.01)  # force race condition
            request_counts_naive[fs_path] = temp + 1

            # Safe counter
            with request_counts_lock:
                if fs_path not in request_counts_safe:
                    request_counts_safe[fs_path] = 0
                request_counts_safe[fs_path] += 1

            print(f"[{thread_name}] Counts - naive: {request_counts_naive[fs_path]}, safe: {request_counts_safe[fs_path]}")

        # Serve directories
        if os.path.isdir(fs_path):
            content = generate_directory_listing(fs_path, path)
            header = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n"
            conn.sendall(header.encode() + content)
            print(f"[{thread_name}] Served directory: {path}")
            return

        # Serve files
        if not os.path.isfile(fs_path):
            header = "HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\n\r\n"
            body = f"<html><body><h1>404 Not Found</h1><p>{path} not found.</p></body></html>"
            conn.sendall(header.encode() + body.encode())
            print(f"[{thread_name}] 404 Not Found: {path}")
            return

        mime_type, _ = mimetypes.guess_type(fs_path)
        if mime_type is None:
            mime_type = "application/octet-stream"

        with open(fs_path, "rb") as f:
            content = f.read()

        header = f"HTTP/1.1 200 OK\r\nContent-Type: {mime_type}\r\nContent-Length: {len(content)}\r\n\r\n"
        conn.sendall(header.encode() + content)
        print(f"[{thread_name}] Served file: {path}")

    except Exception as e:
        print(f"[{thread_name}] Error handling request from {addr}: {e}")
    finally:
        conn.close()
        print(f"[{thread_name}] Connection closed for {addr}")


def main():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, PORT))
        s.listen(5)
        print(f"Serving HTTP on {HOST}:{PORT} from {ROOT_DIR}")
        while True:
            conn, addr = s.accept()
            threading.Thread(target=handle_request, args=(conn, addr), daemon=True).start()


if __name__ == "__main__":
    main()
