# LAB4 - Distributed Key-Value Store with Single-Leader Replication

A distributed key-value storage system implementing single-leader replication with configurable write quorum, network delay simulation, and comprehensive testing suite.

## 📋 Overview

This project implements a distributed key-value store based on Chapter 5 of "Designing Data-Intensive Applications" by Martin Kleppmann. The system uses:

- **Single-Leader Replication**: Only the leader accepts write requests and replicates to followers
- **Semi-Synchronous Replication**: Configurable write quorum (default: 3 confirmations required)
- **Network Delay Simulation**: Random delays between 0.1ms - 1ms to simulate realistic network conditions
- **Concurrent Request Handling**: Thread-safe operations with ThreadPoolExecutor for parallel replication

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ writes
       ▼
┌─────────────────┐
│     Leader      │ (port 5000)
│   (kvstore)     │
└────────┬────────┘
         │ replicates (quorum=3)
    ┌────┴────┬────────┬────────┬────────┐
    ▼         ▼        ▼        ▼        ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Follow 1│ │Follow 2│ │Follow 3│ │Follow 4│ │Follow 5│
│ :5001  │ │ :5002  │ │ :5003  │ │ :5004  │ │ :5005  │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

- **1 Leader Node**: Accepts client writes, replicates to followers
- **5 Follower Nodes**: Receive replicated data from leader
- **Docker Network**: All nodes communicate via `kvstore_network`

## 🚀 Quick Start

### Prerequisites

- Docker Desktop
- Python 3.11+
- Docker Compose

### Start the System

```powershell
# Start all containers (1 leader + 5 followers)
docker-compose up -d --build

# Verify all containers are running
docker ps

# Check logs
docker logs kvstore_leader
docker logs kvstore_follower1
```

### Run Tests

```powershell
# Integration tests (15+ test cases)
python tests\integration_test.py

# Performance benchmark (10K concurrent writes)
python tests\performance_test.py

# Quorum analysis with latency plots
python tests\quorum_analysis.py

# Check data consistency across replicas
python tests\check_consistency.py
```

## 📁 Project Structure

```
LAB4/
├── server.py                    # Core key-value store implementation
├── Dockerfile                   # Container image definition
├── docker-compose.yml           # Multi-container orchestration
├── requirements.txt             # Python dependencies
├── README.md                    # This file
├── tests/
│   ├── integration_test.py      # Comprehensive integration tests
│   ├── performance_test.py      # Load testing & benchmarking
│   ├── quorum_analysis.py       # Quorum vs latency analysis
│   └── check_consistency.py     # Data consistency verification
└── downloads/                   # Test results & generated plots
```

## 🔌 API Endpoints

### Leader & Follower Endpoints

#### `GET /status`

Get node status and current data count

```json
{
  "node_type": "leader",
  "data_count": 42,
  "data": {"key1": "value1", ...}
}
```

#### `GET /get/<key>`

Read a value by key (works on both leader and followers)

```json
{
  "success": true,
  "key": "mykey",
  "value": "myvalue"
}
```

### Leader-Only Endpoints

#### `POST /set`

Write a key-value pair (leader only, requires quorum confirmations)

```json
// Request
{
  "key": "mykey",
  "value": "myvalue"
}

// Response
{
  "success": true,
  "key": "mykey",
  "value": "myvalue",
  "replicas": 4
}
```

### Follower-Only Endpoints

#### `POST /replicate`

Receive replication from leader (internal use only)

```json
{
  "key": "mykey",
  "value": "myvalue"
}
```

## ⚙️ Configuration

Configure via environment variables in `docker-compose.yml`:

| Variable       | Default  | Description                               |
| -------------- | -------- | ----------------------------------------- |
| `NODE_TYPE`    | `leader` | Node role: `leader` or `follower`         |
| `PORT`         | `5000`   | Internal container port                   |
| `WRITE_QUORUM` | `3`      | Number of follower confirmations required |
| `MIN_DELAY`    | `0.0001` | Minimum network delay (0.1ms)             |
| `MAX_DELAY`    | `0.001`  | Maximum network delay (1ms)               |
| `FOLLOWERS`    | -        | Comma-separated follower URLs             |

### Adjusting Write Quorum

Edit `docker-compose.yml`:

```yaml
environment:
  - WRITE_QUORUM=5 # Require all 5 followers to confirm
```

Then restart:

```powershell
docker-compose down
docker-compose up -d --build
```

## 🧪 Testing

### Integration Tests

Tests all core functionality:

- Leader status verification
- Write operations with quorum enforcement
- Read from leader and followers
- Replication propagation
- Concurrent writes
- Consistency verification

```powershell
python tests\integration_test.py
```

### Performance Tests

Benchmarks system under load:

- 10,000 concurrent write operations
- 100 unique keys with random values
- 20 concurrent threads
- Measures average, median, P95, P99 latency
- Post-write consistency verification

```powershell
python tests\performance_test.py
```

Expected output:

```
Total writes: 10000
Successful: 10000
Failed: 0
Throughput: ~250 writes/sec
Average latency: ~80ms
P95 latency: ~120ms
```

### Quorum Analysis

Tests different quorum values (1-5) and generates plots:

- Measures latency vs quorum size
- Generates `quorum_analysis.png` graph
- Takes 5-10 minutes to complete

```powershell
python tests\quorum_analysis.py
```

### Consistency Checks

Verifies data integrity across all nodes:

- Compares leader data with all followers
- Reports any inconsistencies
- Useful after system recovery

```powershell
python tests\check_consistency.py
```

## 🔍 Monitoring

### View Logs

```powershell
# Leader logs
docker logs kvstore_leader -f

# Specific follower logs
docker logs kvstore_follower1 -f

# All logs
docker-compose logs -f
```

### Check Node Status

```powershell
# Leader status
curl http://localhost:5000/status

# Follower status
curl http://localhost:5001/status
curl http://localhost:5002/status
```

### Manual Testing

```powershell
# Write a key-value pair
curl -X POST http://localhost:5000/set -H "Content-Type: application/json" -d "{\"key\":\"test\",\"value\":\"hello\"}"

# Read from leader
curl http://localhost:5000/get/test

# Read from follower (after replication)
curl http://localhost:5001/get/test
```

## 🛠️ Troubleshooting

### Containers won't start

```powershell
# Check if ports are already in use
netstat -ano | findstr :5000

# Remove old containers and networks
docker-compose down -v
docker system prune -f

# Rebuild from scratch
docker-compose up -d --build --force-recreate
```

### Write operations failing

```powershell
# Check leader logs for errors
docker logs kvstore_leader

# Verify follower connectivity
docker exec kvstore_leader curl http://follower1:5000/status

# Check write quorum setting
docker exec kvstore_leader env | grep WRITE_QUORUM
```

### Data inconsistency

```powershell
# Run consistency check
python tests\check_consistency.py

# Restart all containers (data is lost - in-memory storage)
docker-compose restart
```

### Performance issues

```powershell
# Check container resource usage
docker stats

# Reduce write quorum for faster writes (less durability)
# Edit WRITE_QUORUM in docker-compose.yml to 1 or 2
```

## 🔧 Implementation Details

### How Requests Are Handled

#### POST /set (Leader)

Accepts JSON `{"key": ..., "value": ...}`

- Saves to leader's in-memory store
- Calls `replicate_to_followers()` to semi-synchronously copy data to followers

```python
@app.route('/set', methods=['POST'])
def set_value():
    if NODE_TYPE != 'leader':
        return jsonify({'success': False, 'error': 'Only leader accepts write requests'}), 403

    data = request.get_json()
    key = data['key']
    value = data['value']

    with data_lock:
        data_store[key] = value

    success_count = replicate_to_followers(key, value)

    if success_count >= WRITE_QUORUM:
        return jsonify({'success': True, 'key': key, 'value': value, 'replicas': success_count})
    else:
        return jsonify({'success': False, 'error': 'Not enough replicas confirmed'}), 500
```

#### POST /replicate (Followers)

Followers accept replication requests from leader and write to their local store

```python
@app.route('/replicate', methods=['POST'])
def replicate():
    if NODE_TYPE != 'follower':
        return jsonify({'success': False, 'error': 'Only followers accept replication requests'}), 403

    data = request.get_json()
    key = data['key']
    value = data['value']

    with data_lock:
        data_store[key] = value

    return jsonify({'success': True, 'key': key})
```

#### GET /get/<path:key>

Retrieve a stored key (note: we use the "path" converter so keys with slashes work)

```python
@app.route('/get/<path:key>', methods=['GET'])
def get_value(key):
    with data_lock:
        if key in data_store:
            return jsonify({'success': True, 'key': key, 'value': data_store[key]})
        else:
            return jsonify({'success': False, 'error': 'Key not found'}), 404
```

### Multithreading and Concurrency

- Flask server is started with threading enabled (`app.run(..., threaded=True)`) which lets the Flask process accept and handle multiple HTTP requests concurrently
- Internal writes to the shared in-memory dictionary `data_store` are protected by `data_lock = threading.Lock()` to avoid concurrent-write races
- Replication to followers is done concurrently using a ThreadPoolExecutor - each follower replication runs in its own worker thread

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def replicate_to_followers(key, value):
    def replicate_to_one_follower(follower_url):
        # optional simulated network delay
        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
        response = requests.post(f"{follower_url}/replicate",
                                json={'key': key, 'value': value}, timeout=5)
        return response.status_code == 200

    success_count = 0
    with ThreadPoolExecutor(max_workers=len(FOLLOWERS)) as executor:
        futures = [executor.submit(replicate_to_one_follower, f) for f in FOLLOWERS]
        for future in as_completed(futures):
            if future.result():
                success_count += 1
                if success_count >= WRITE_QUORUM:
                    break
    return success_count
```

**Notes:**

- `ThreadPoolExecutor` makes replication requests in parallel, but the leader only waits until the write-quorum is reached (early exit optimization)
- The `data_lock` ensures `data_store` updates are atomic with respect to other threads handling requests

## 📊 Key Features

### ✅ Implemented

- [x] Single-leader replication architecture
- [x] Semi-synchronous replication with configurable quorum
- [x] Network delay simulation (0.1ms - 1ms)
- [x] Thread-safe concurrent request handling
- [x] REST API for reads and writes
- [x] Docker containerization with docker-compose
- [x] Comprehensive test suite
- [x] Performance benchmarking
- [x] Quorum vs latency analysis with plots
- [x] Data consistency verification

### 🔄 Replication Strategy

**Semi-Synchronous Replication:**

- Leader writes to its own storage immediately
- Replicates to all 5 followers concurrently (using ThreadPoolExecutor)
- Each replication has independent network delay (0.1ms - 1ms)
- Write succeeds if >= WRITE_QUORUM followers confirm
- Default quorum = 3 (majority of 5 followers)

**Trade-offs:**

- Higher quorum → More durability, higher latency
- Lower quorum → Lower latency, risk of data loss on failures

## 🎓 Learning Objectives

This lab demonstrates:

1. **Distributed Systems Concepts**

   - Leader-based replication
   - Write quorum and consistency guarantees
   - Network delay impact on performance

2. **Concurrent Programming**

   - Thread-safe data structures (locks)
   - Parallel request handling (ThreadPoolExecutor)
   - Asynchronous replication

3. **Containerization**

   - Multi-container orchestration with docker-compose
   - Service discovery via container names
   - Network isolation and communication

4. **Testing Distributed Systems**
   - Integration testing with multiple services
   - Performance benchmarking
   - Consistency verification

## 📚 References

- **Book**: "Designing Data-Intensive Applications" by Martin Kleppmann (Chapter 5: Replication)
- **Flask**: Web framework for Python REST API
- **Docker**: Container platform for distributed deployment
- **ThreadPoolExecutor**: Python concurrent execution library

## 🧹 Cleanup

```powershell
# Stop and remove all containers
docker-compose down

# Remove all data and networks
docker-compose down -v

# Remove Docker images
docker rmi lab4-leader lab4-follower1 lab4-follower2 lab4-follower3 lab4-follower4 lab4-follower5
```

## 📝 Notes

- **Data Persistence**: All data is stored in-memory. Restarting containers will lose all data.
- **Network**: Containers communicate via `kvstore_network` bridge network.
- **Scalability**: Currently supports 5 followers. To add more, update docker-compose.yml and FOLLOWERS env variable.
- **Path Keys**: The `/get/<path:key>` endpoint supports keys with slashes (e.g., `src/subdir/hello.html`)

---

**Author**: PR Labs  
**Date**: November 2025  
**Course**: Distributed Systems Lab
