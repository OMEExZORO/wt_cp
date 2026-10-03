import { useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, EmptyState, Spinner, formatDate, useAsync } from '../../components/ui.jsx';

export default function Messages() {
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/messages'), []);
  const [message, setMessage] = useState('');

  const markRead = async (m) => {
    try {
      await api.patch(`/admin/messages/${m.id}/read`, {});
      reload();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <h1>Contact messages</h1>
      <Alert type="error">{error || message}</Alert>
      {loading && <Spinner />}
      {!loading && data?.length === 0 && <EmptyState title="No messages">Messages from the website contact form appear here.</EmptyState>}
      <div className="message-list">
        {(data || []).map((m) => (
          <article key={m.id} className={`panel message ${m.is_read ? 'read' : ''}`}>
            <header>
              <strong>{m.name}</strong>
              <span className="muted">
                {m.email}
                {m.phone && ` • ${m.phone}`} • {formatDate(m.created_at)}
                {m.branch_name && ` • ${m.branch_name}`}
              </span>
            </header>
            <p className="pre">{m.message}</p>
            {!m.is_read && (
              <button type="button" className="btn btn-sm btn-outline" onClick={() => markRead(m)}>
                Mark as read
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
