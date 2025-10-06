import socket
import sys
import os
import mimetypes
from urllib.parse import unquote

# Get directory to serve from command-line
if len(sys.argv) < 2:
    print("Usage: python server.py <directory_to_serve>")
    sys.exit(1)

root_dir = sys.argv[1]

HOST = '0.0.0.0'
PORT = 8080


def generate_directory_listing(path, request_path):
    """Generate HTML page listing files in directory"""
    import os

    items = os.listdir(path)
    html = f"<html><body><h2>Directory listing for {request_path}</h2><ul>"

    if request_path != "/":
        # Add parent directory link
        parent_path = os.path.dirname(request_path.rstrip('/'))
        html += f'<li><a href="{parent_path or "/"}">.. (parent directory)</a></li>'

    for item in items:
        item_path = os.path.join(request_path, item)
        html += f'<li><a href="{item_path}">{item}</a></li>'

    # 👇 Add a test link to a non-existent file to trigger 404
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
        path = unquote(path)  # decode URL-encoded characters
        fs_path = os.path.join(root_dir, path.lstrip("/"))

        if os.path.isdir(fs_path):
            # Serve directory listing
            content = generate_directory_listing(fs_path, path)
            header = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n"
            conn.sendall(header.encode() + content)
            return

        if not os.path.isfile(fs_path):
            # File not found
            header = "HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\n\r\n"
            body = f"<html><body><h1>404 Not Found</h1><p>{path} not found.</p></body></html>"
            conn.sendall(header.encode() + body.encode())
            return

        # Determine MIME type
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
        print(f"Serving HTTP on {HOST}:{PORT} from {root_dir}")
        while True:
            conn, addr = s.accept()
            handle_request(conn)

if __name__ == "__main__":
    main()
