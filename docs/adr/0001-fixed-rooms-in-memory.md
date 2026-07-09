# Fixed three rooms with in-memory table state

VP Play only needs three concurrent tables. Room seats and mid-hand state live in process memory (`roomTable`). SQLite stores users and cumulative points only.

Server restart drops in-flight hands; acceptable for a small LAN MVP and avoids mid-hand persistence complexity.
