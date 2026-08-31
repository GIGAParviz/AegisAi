# from qdrant_client import QdrantClient

# client = QdrantClient(url="http://localhost:6333")

# print(client)

from redis import Redis

rd= Redis(
    host='localhost',
    port=6379
)

print(rd)
