import threading
import socket
import time

# CONFIGURE HERE
HOST = "localhost"
PORT = 8080
NUM_REQUESTS = 10
CLIENT_TYPE = "low"  # "low" (sub limit) or "high" (above limit)
PATH = "/index.html"

def make_request(host, port, path="/"):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((host, port))
        req = f"GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
        s.sendall(req.encode('utf-8'))
        resp = b""
        while True:
            data = s.recv(4096)
            if not data:
                break
            resp += data
        s.close()
        return True, resp
    except Exception as e:
        print("Request error:", e)
        return False, None

def worker(host, port, path, results, idx, delay=0.0):
    time.sleep(delay)
    ok, resp = make_request(host, port, path)
    results[idx] = ok

def main():
    threads = []
    results = [False] * NUM_REQUESTS

    # Delay between requests depending on client type
    delay = 0.25 if CLIENT_TYPE == "low" else 0.05

    start = time.time()
    for i in range(NUM_REQUESTS):
        t = threading.Thread(target=worker, args=(HOST, PORT, PATH, results, i, i * delay))
        t.start()
        threads.append(t)

    for t in threads:
        t.join()
    end = time.time()

    success = sum(1 for r in results if r)
    print(f"Client '{CLIENT_TYPE}': Requests={NUM_REQUESTS}, Success={success}, Time elapsed={end - start:.3f} sec")

if __name__ == "__main__":
    main()
