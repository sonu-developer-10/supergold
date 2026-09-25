import React, { useEffect, useState } from 'react';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:5000/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching dashboard stats:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>Loading Dashboard...</div>;
  if (!stats) return <div style={{ padding: '20px' }}>Dashboard Data Load Nahi Ho Paya.</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>📊 Admin Business Summary Dashboard</h2>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginTop: '20px' }}>
        <div style={cardStyle('#3f51b5')}>
          <h3>Total Sales</h3>
          <p style={numberStyle}>₹{stats.totalSales.toLocaleString()}</p>
        </div>

        <div style={cardStyle('#2e7d32')}>
          <h3>Total Received</h3>
          <p style={numberStyle}>₹{stats.totalCollection.toLocaleString()}</p>
          <small>Cash: ₹{stats.totalCashCollected} | Online: ₹{stats.totalOnlineCollected}</small>
        </div>

        <div style={cardStyle('#c62828')}>
          <h3>Total Outstanding Due</h3>
          <p style={numberStyle}>₹{stats.totalOutstanding.toLocaleString()}</p>
        </div>

        <div style={cardStyle('#f57c00')}>
          <h3>Total Parties</h3>
          <p style={numberStyle}>{stats.totalParties}</p>
        </div>

        <div style={cardStyle('#00838f')}>
          <h3>Available Stock Pairs</h3>
          <p style={numberStyle}>{stats.totalStockPairs} Pairs</p>
        </div>

        <div style={cardStyle('#6a1b9a')}>
          <h3>Master Articles</h3>
          <p style={numberStyle}>{stats.totalArticles}</p>
        </div>
      </div>

      {/* Recent Bills Table */}
      <div style={{ marginTop: '30px' }}>
        <h3>📄 Recent Invoices / Bills</h3>
        <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th>Bill No</th>
              <th>Party Name</th>
              <th>Bill Amount</th>
              <th>Paid</th>
              <th>Due Balance</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentBills.map((bill) => (
              <tr key={bill._id}>
                <td>#{bill.billNo}</td>
                <td>{bill.partyName}</td>
                <td>₹{bill.todayTotal}</td>
                <td>₹{bill.amountPaid}</td>
                <td>₹{bill.dueBalance}</td>
                <td>{new Date(bill.billDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cardStyle = (bgColor) => ({
  backgroundColor: bgColor,
  color: '#fff',
  padding: '15px',
  borderRadius: '8px',
  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
});

const numberStyle = {
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '10px 0'
};

export default AdminDashboard;