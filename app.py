import streamlit as st
import sqlite3
from datetime import datetime, timedelta

conn = sqlite3.connect("loans.db")
c = conn.cursor()

st.title("🏪 Finance Management System")

# Add customer
st.header("Add Loan")

name = st.text_input("Customer Name")
phone = st.text_input("Phone Number")
amount = st.number_input("Loan Amount")
interest = st.number_input("Interest %")
item = st.text_input("Surety Item")

if st.button("Add Loan"):
    loan_date = datetime.today().strftime("%Y-%m-%d")
    
    c.execute("INSERT INTO loans (name, phone, amount, interest, loan_date, item) VALUES (?, ?, ?, ?, ?, ?)",
              (name, phone, amount, interest, loan_date, item))
    
    conn.commit()
    st.success("Loan Added!")

# Show loans
st.header("Customer List")

c.execute("SELECT * FROM loans")
rows = c.fetchall()

for row in rows:
    loan_date = datetime.strptime(row[5], "%Y-%m-%d")
    due_date = loan_date + timedelta(days=28)
    
    if datetime.today() >= due_date:
        st.error(f"{row[1]} → Payment Due! 📞 {row[2]}")
    else:
        st.write(f"{row[1]} → Active")