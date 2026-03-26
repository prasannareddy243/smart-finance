import sqlite3

conn = sqlite3.connect("loans.db")
c = conn.cursor()

c.execute("""
CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    amount REAL,
    interest REAL,
    loan_date TEXT,
    item TEXT
)
""")

conn.commit()