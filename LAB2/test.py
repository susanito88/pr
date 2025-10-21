import requests
import time
from concurrent.futures import ThreadPoolExecutor

URL = "http://localhost:8080/subdir/hello.html"  # change if needed

def make_request(i):
    r = requests.get(URL)
    print(f"Request {i} finished with status {r.status_code}")

start = time.time()

with ThreadPoolExecutor(max_workers=10) as executor:
    executor.map(make_request, range(10))

end = time.time()
print(f"All 10 requests completed in {end - start:.2f} seconds")
