import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || ''; 

const App = () => {
  const [entity, setEntity] = useState('accounts');
  const [method, setMethod] = useState('GET');
  const [id, setId] = useState('');
  const [payload, setPayload] = useState('{\n  "account_name": "Test Account",\n  "balance": 100.00\n}');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTestCall = async () => {
    setLoading(true);
    setResponse(null);
    try {
      let url = `${API_URL}/api/${entity}`;
      if (id) {
        url += `?id=${id}`;
      }

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (method === 'POST' || method === 'PUT') {
        // Only parse payload if it's not empty, otherwise we might send empty string which isn't valid JSON
        if (payload.trim()) {
           try {
             JSON.parse(payload); // validate JSON before sending
             options.body = payload;
           } catch(e) {
             setResponse({ error: "Invalid JSON format in the payload text box." });
             setLoading(false);
             return;
           }
        }
      }

      const res = await fetch(url, options);
      const data = await res.json();
      setResponse({ status: res.status, data });
    } catch (err: any) {
      setResponse({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEntityChange = (newEntity: string) => {
    setEntity(newEntity);
    if (newEntity === 'accounts') {
      setPayload('{\n  "account_name": "Test Account",\n  "balance": 100.00\n}');
    } else if (newEntity === 'envelops') {
      setPayload('{\n  "source_name": "Groceries",\n  "type": "Expense",\n  "is_active": true\n}');
    } else if (newEntity === 'transactions') {
      const today = new Date().toISOString().split('T')[0];
      setPayload(`{\n  "transaction_date": "${today}",\n  "source_name": "Supermarket",\n  "amount": 54.20,\n  "closing_balance": 946.30\n}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>API Tester Playground</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
        Test your new Vercel serverless database endpoints directly from the UI.
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Entity Table</label>
          <select value={entity} onChange={(e) => handleEntityChange(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
            <option value="accounts">Accounts</option>
            <option value="envelops">Envelops</option>
            <option value="transactions">Transactions</option>
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>HTTP Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
            <option value="GET">GET (Fetch)</option>
            <option value="POST">POST (Create new)</option>
            <option value="PUT">PUT (Update existing)</option>
            <option value="DELETE">DELETE (Remove)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Record ID</label>
          <input 
            type="number" 
            value={id} 
            onChange={(e) => setId(e.target.value)} 
            placeholder="e.g. 1 (Leave empty for ALL)" 
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
        </div>
      </div>

      {(method === 'POST' || method === 'PUT') && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
            JSON Body Payload 
            <span style={{ fontWeight: 'normal', color: '#666', fontSize: '0.9em', marginLeft: '10px' }}>
              (Edit the defaults based on what you want to {method === 'POST' ? 'create' : 'update'})
            </span>
          </label>
          <textarea 
            value={payload} 
            onChange={(e) => setPayload(e.target.value)} 
            style={{ width: '100%', height: '180px', fontFamily: 'monospace', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical' }}
          />
        </div>
      )}

      <button 
        onClick={handleTestCall} 
        disabled={loading}
        style={{ 
          width: '100%', 
          padding: '14px', 
          backgroundColor: loading ? '#ccc' : '#000', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px', 
          cursor: loading ? 'not-allowed' : 'pointer', 
          fontSize: '16px',
          fontWeight: 'bold',
          transition: 'background-color 0.2s'
        }}
      >
        {loading ? 'Sending Request to Database...' : '🚀 Send API Request'}
      </button>

      {response && (
        <div style={{ marginTop: '30px', animation: 'fadeIn 0.5s' }}>
          <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
            Response Status: <span style={{ color: response.status >= 400 ? 'red' : 'green' }}>{response.status || 'N/A'}</span>
          </h3>
          <pre style={{ 
            backgroundColor: '#1e1e1e', 
            color: '#d4d4d4', 
            padding: '20px', 
            borderRadius: '8px', 
            overflowX: 'auto',
            fontSize: '14px' 
          }}>
            {JSON.stringify(response.data || response.error, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;