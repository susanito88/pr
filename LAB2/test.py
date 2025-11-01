import requests
import time
from concurrent.futures import ThreadPoolExecutor

URL = "http://localhost:8081/doc.pdf"

def make_request(i):
    r = requests.get(URL)
    print(f"Request {i} finished with status {r.status_code}")

start = time.time()

with ThreadPoolExecutor(max_workers=20) as executor:
    executor.map(make_request, range(20))

end = time.time()
print(f"All 10 requests completed in {end - start:.2f} seconds")
