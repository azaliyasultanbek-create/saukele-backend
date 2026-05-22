import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import './AdminDashboard.css';

const tierLabels = {
  parents: 'Родители',
  siblings: 'Братья / сестры',
  nephews: 'Племянники',
  distant: 'Дальние родственники',
};

// ==============================
// Модалка редактирования свадьбы
// ==============================
function WeddingEditModal({ wedding, onClose, onSave }) {
  const [form, setForm] = useState({
    partner2Name: wedding?.partner2Name || '',
    weddingDate: wedding?.weddingDate ? wedding.weddingDate.split('T')[0] : '',
    venue: wedding?.venue || '',
    story: wedding?.story || '',
    isActive: wedding?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/admin/weddings/${wedding.coupleId}`, form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Редактировать свадьбу</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="wed-edit-profile">
            <div className="wed-edit-avatar">{wedding?.couple?.fullName?.[0] || '?'}</div>
            <div>
              <strong>{wedding?.couple?.fullName || '?'}</strong> & {wedding?.partner2Name || '?'}
              <br /><small className="text-muted">{wedding?.couple?.phone}</small>
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Дата свадьбы</label>
                <input type="date" name="weddingDate" value={form.weddingDate} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Место</label>
                <input name="venue" value={form.venue} onChange={handleChange} placeholder="Ресторан, зал..." />
              </div>
            </div>
            <div className="form-group">
              <label>Второй партнёр</label>
              <input name="partner2Name" value={form.partner2Name} onChange={handleChange} placeholder="Имя и фамилия" />
            </div>
            <div className="form-group">
              <label>История</label>
              <textarea name="story" value={form.story} onChange={handleChange} rows={3} placeholder="Как познакомились..." />
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
                <span>Свадьба активна</span>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>Отмена</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==============================
// Модалка подтверждения удаления
// ==============================
function DeleteConfirmModal({ wedding, onClose, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try { await api.delete(`/admin/weddings/${wedding.coupleId}`); onDelete(); }
    catch (err) { alert(err.response?.data?.message || 'Ошибка'); }
    finally { setDeleting(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Деактивировать свадьбу?</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p>Свадьба <strong>{wedding?.couple?.fullName}</strong> и <strong>{wedding?.partner2Name}</strong> будет скрыта из публичного списка.</p>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={onClose}>Отмена</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Деактивация...' : 'Да, деактивировать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================
// Модалка просмотра деталей
// ==============================
function WeddingDetailsModal({ coupleId, onClose }) {
  const [wedding, setWedding] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { const r = await api.get(`/admin/weddings/${coupleId}`); setWedding(r.data.wedding); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [coupleId]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Детали свадьбы</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {loading ? <div className="admin-loading">Загрузка...</div>
          : wedding ? (
            <>
              <div className="det-profile">
                <div className="det-avatar">{wedding.couple?.fullName?.[0] || '?'}</div>
                <div className="det-info">
                  <h3>{wedding.couple?.fullName} & {wedding.partner2Name}</h3>
                  <p>📞 {wedding.couple?.phone} · ✉️ {wedding.couple?.email || '—'}</p>
                  <p>📅 {new Date(wedding.weddingDate).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}{wedding.venue ? ` · 📍 ${wedding.venue}` : ''}</p>
                  <span className={`status-badge ${wedding.isActive ? 'active' : 'inactive'}`}>{wedding.isActive ? 'Активна' : 'Неактивна'}</span>
                </div>
              </div>
              {wedding.story && <div className="det-section"><h4>📖 История</h4><p>{wedding.story}</p></div>}
              <div className="det-section">
                <h4>🎁 Подарки ({wedding.gifts?.length || 0})</h4>
                <div className="det-gifts">
                  {(wedding.gifts || []).map(g => (
                    <div key={g.id} className="det-gift">
                      <span className="det-gift-name">{g.name}</span>
                      <span className={`status-badge ${g.status}`}>{g.status}</span>
                      <span>{g.fundedAmount.toLocaleString()} / {g.targetAmount.toLocaleString()} {g.currency}</span>
                      <span>📦 {g.contributionsCount}</span>
                    </div>
                  ))}
                  {(!wedding.gifts || !wedding.gifts.length) && <p className="text-muted">Нет подарков</p>}
                </div>
              </div>
              <div className="det-section">
                <h4>👨‍👩‍👧‍👦 Родственники ({wedding.familyMembers?.length || 0})</h4>
                <div className="det-family">
                  {(wedding.familyMembers || []).map(f => (
                    <span key={f.id} className="family-chip">{f.guest?.fullName || '—'} <small>{tierLabels[f.kinshipTier] || f.kinshipTier}</small></span>
                  ))}
                  {(!wedding.familyMembers || !wedding.familyMembers.length) && <p className="text-muted">Нет родственников</p>}
                </div>
              </div>
            </>
          ) : <div className="error-message">Не удалось загрузить данные</div>}
        </div>
      </div>
    </div>
  );
}

// ==============================
// Главный компонент
// ==============================
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('weddings');
  const [stats, setStats] = useState(null);
  const [weddings, setWeddings] = useState([]);
  const [weddingsPage, setWeddingsPage] = useState(1);
  const [weddingsTotal, setWeddingsTotal] = useState(0);
  const [weddingsLoading, setWeddingsLoading] = useState(false);
  const [weddingsSearch, setWeddingsSearch] = useState('');
  const [weddingsStatusFilter, setWeddingsStatusFilter] = useState('all');
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('');
  const [queueStats, setQueueStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [editWedding, setEditWedding] = useState(null);
  const [deleteWedding, setDeleteWedding] = useState(null);
  const [detailsWid, setDetailsWid] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try { const r = await api.get('/admin/stats'); setStats(r.data); } catch (e) { setStats(null); }
    finally { setLoadingStats(false); }
  }, []);

  const loadWeddings = useCallback(async (page, q, status) => {
    setWeddingsLoading(true);
    try {
      let url = `/admin/weddings?page=${page}&limit=20`;
      if (q) url += `&search=${encodeURIComponent(q)}`;
      if (status && status !== 'all') url += `&status=${status}`;
      const r = await api.get(url); setWeddings(r.data.weddings); setWeddingsTotal(r.data.pagination.total);
    } catch (e) { console.error(e); }
    finally { setWeddingsLoading(false); }
  }, []);

  const loadUsers = useCallback(async (page, q, role) => {
    setUsersLoading(true);
    try {
      let url = `/admin/users?page=${page}&limit=20`;
      if (q) url += `&search=${encodeURIComponent(q)}`;
      if (role) url += `&role=${role}`;
      const r = await api.get(url); setUsers(r.data.users); setUsersTotal(r.data.pagination.total);
    } catch (e) { console.error(e); }
    finally { setUsersLoading(false); }
  }, []);

  const loadQueues = useCallback(async () => {
    try { const r = await api.get('/admin/queues'); setQueueStats(r.data); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { if (activeTab === 'overview') loadStats(); if (activeTab === 'queues') loadQueues(); }, [activeTab, loadStats, loadQueues]);
  useEffect(() => { if (activeTab === 'weddings') loadWeddings(weddingsPage, weddingsSearch, weddingsStatusFilter); }, [activeTab, weddingsPage, loadWeddings]);
  useEffect(() => { if (activeTab === 'users') loadUsers(usersPage, usersSearch, usersRoleFilter); }, [activeTab, usersPage, loadUsers]);

  useEffect(() => {
    if (activeTab !== 'weddings') return;
    const t = setTimeout(() => { setWeddingsPage(1); loadWeddings(1, weddingsSearch, weddingsStatusFilter); }, 400);
    return () => clearTimeout(t);
  }, [weddingsSearch, weddingsStatusFilter, activeTab, loadWeddings]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    const t = setTimeout(() => { setUsersPage(1); loadUsers(1, usersSearch, usersRoleFilter); }, 400);
    return () => clearTimeout(t);
  }, [usersSearch, usersRoleFilter, activeTab, loadUsers]);

  const onWeddingSaved = () => { setEditWedding(null); showToast('Свадьба обновлена'); loadWeddings(weddingsPage, weddingsSearch, weddingsStatusFilter); };
  const onWeddingDeleted = () => { setDeleteWedding(null); showToast('Свадьба деактивирована', 'warning'); loadWeddings(weddingsPage, weddingsSearch, weddingsStatusFilter); };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const fmtShort = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—';
  const wp = Math.max(1, Math.ceil(weddingsTotal / 20));
  const up = Math.max(1, Math.ceil(usersTotal / 20));

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Панель администратора</h1>
        <p className="admin-subtitle">Управление свадьбами, пользователями и системой</p>
      </div>
      <div className="admin-tabs">
        {[
          { key: 'overview', icon: '📊', label: 'Обзор' },
          { key: 'weddings', icon: '💒', label: 'Свадьбы', count: weddingsTotal },
          { key: 'users', icon: '👥', label: 'Пользователи' },
          { key: 'queues', icon: '⚙️', label: 'Очереди' },
        ].map(t => (
          <button key={t.key} className={`admin-tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            <span className="tab-icon">{t.icon}</span> {t.label}{t.count > 0 && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      {editWedding && <WeddingEditModal wedding={editWedding} onClose={() => setEditWedding(null)} onSave={onWeddingSaved} />}
      {deleteWedding && <DeleteConfirmModal wedding={deleteWedding} onClose={() => setDeleteWedding(null)} onDelete={onWeddingDeleted} />}
      {detailsWid && <WeddingDetailsModal coupleId={detailsWid} onClose={() => setDetailsWid(null)} />}

      {activeTab === 'overview' && (
        <div className="admin-overview">
          {loadingStats ? <div className="admin-loading"><div className="spinner"></div><span>Загрузка...</span></div>
          : !stats ? <div className="error-message">Не удалось загрузить статистику</div>
          : (<>
              <div className="stats-grid">
                {[
                  { icon: '👥', num: stats?.stats?.users?.total || 0, label: 'Пользователей', detail: `👫 ${stats?.stats?.users?.couples || 0} пар · 👤 ${stats?.stats?.users?.guests || 0} гостей` },
                  { icon: '💒', num: stats?.stats?.weddings?.active || 0, label: 'Активных свадеб', detail: `📋 Всего: ${stats?.stats?.weddings?.total || 0}` },
                  { icon: '🎁', num: stats?.stats?.gifts?.total || 0, label: 'Подарков' },
                  { icon: '💰', num: stats?.stats?.contributions?.total || 0, label: 'Вкладов', detail: `Сумма: ${(stats?.stats?.contributions?.totalAmount || 0).toLocaleString()} ₸` },
                ].map((c, i) => (
                  <div key={i} className="stat-card">
                    <div className="stat-icon">{c.icon}</div>
                    <div className="stat-info"><span className="stat-number">{c.num}</span><span className="stat-label">{c.label}</span></div>
                    {c.detail && <div className="stat-detail">{c.detail}</div>}
                  </div>
                ))}
              </div>
              <div className="admin-section-row">
                {stats?.recentUsers?.length > 0 && (
                  <div className="admin-section">
                    <h2>Последние регистрации</h2>
                    <div className="recent-list">{stats.recentUsers.map(u => (
                      <div key={u.id} className="recent-item">
                        <div className="recent-avatar">{u.fullName?.[0] || '?'}</div>
                        <div className="recent-info"><strong>{u.fullName || '—'}</strong><small>{u.phone}</small></div>
                        <span className={`role-badge role-${u.role}`}>{u.role}</span>
                      </div>
                    ))}</div>
                  </div>
                )}
                {stats?.recentContributions?.length > 0 && (
                  <div className="admin-section">
                    <h2>Последние вклады</h2>
                    <div className="recent-list">{stats.recentContributions.map(c => (
                      <div key={c.id} className="recent-item">
                        <div className="recent-avatar">{c.guestName?.[0] || '?'}</div>
                        <div className="recent-info"><strong>{c.guestName}</strong><small>{c.giftName} · {c.amount.toLocaleString()} ₸</small></div>
                      </div>
                    ))}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'weddings' && (
        <div className="admin-weddings">
          <div className="admin-toolbar">
            <div className="toolbar-left"><h2>Свадьбы <span className="count-badge">{weddingsTotal}</span></h2></div>
            <div className="toolbar-right">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Поиск по имени..." value={weddingsSearch} onChange={e => setWeddingsSearch(e.target.value)} />
                {weddingsSearch && <button className="search-clear" onClick={() => setWeddingsSearch('')}>&times;</button>}
              </div>
              <select value={weddingsStatusFilter} onChange={e => setWeddingsStatusFilter(e.target.value)} className="filter-select">
                <option value="all">Все</option><option value="active">Активные</option><option value="inactive">Неактивные</option>
              </select>
            </div>
          </div>
          {weddingsLoading ? <div className="admin-loading"><div className="spinner"></div><span>Загрузка...</span></div>
          : weddings.length === 0 ? <div className="empty-state"><div className="empty-icon">💒</div><h3>Свадьбы не найдены</h3></div>
          : (<>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Пара</th><th>Дата</th><th>Статус</th><th className="center">🎁</th><th className="center">👥</th><th className="actions-col">Действия</th></tr></thead>
                  <tbody>{weddings.map(w => (
                    <tr key={w.coupleId} className={!w.isActive ? 'row-inactive' : ''}>
                      <td><div className="couple-info"><div className="couple-avatar">{w.couple?.fullName?.[0] || '?'}</div><div><strong>{w.couple?.fullName || '—'}</strong> & {w.partner2Name || '?'}<br /><small className="text-muted">{w.couple?.phone}</small></div></div></td>
                      <td>{fmtShort(w.weddingDate)}</td>
                      <td><span className={`status-badge ${w.isActive ? 'active' : 'inactive'}`}>{w.isActive ? 'Активна' : 'Неактивна'}</span></td>
                      <td className="center">{w.giftsCount || 0}</td>
                      <td className="center">{w.familyMembersCount || 0}</td>
                      <td className="actions-cell">
                        <button className="btn-icon" onClick={() => setDetailsWid(w.coupleId)} title="Детали">👁️</button>
                        <button className="btn-icon" onClick={() => setEditWedding(w)} title="Редактировать">✏️</button>
                        {w.isActive && <button className="btn-icon btn-icon-del" onClick={() => setDeleteWedding(w)} title="Деактивировать">🗑️</button>}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {wp > 1 && (
                <div className="pagination">
                  <button disabled={weddingsPage === 1} onClick={() => setWeddingsPage(weddingsPage - 1)} className="btn btn-outline">← Назад</button>
                  <div className="page-numbers">{Array.from({ length: Math.min(wp, 7) }, (_, i) => { let p = wp <= 7 ? i + 1 : weddingsPage <= 4 ? i + 1 : weddingsPage >= wp - 3 ? wp - 6 + i : weddingsPage - 3 + i; return <button key={p} className={`page-num ${p === weddingsPage ? 'active' : ''}`} onClick={() => setWeddingsPage(p)}>{p}</button>; })}</div>
                  <button disabled={weddingsPage >= wp} onClick={() => setWeddingsPage(weddingsPage + 1)} className="btn btn-outline">Вперед →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-users">
          <div className="admin-toolbar">
            <div className="toolbar-left"><h2>Пользователи <span className="count-badge">{usersTotal}</span></h2></div>
            <div className="toolbar-right">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Поиск..." value={usersSearch} onChange={e => setUsersSearch(e.target.value)} />
                {usersSearch && <button className="search-clear" onClick={() => setUsersSearch('')}>&times;</button>}
              </div>
              <select value={usersRoleFilter} onChange={e => setUsersRoleFilter(e.target.value)} className="filter-select">
                <option value="">Все роли</option><option value="couple">Пара</option><option value="guest">Гость</option><option value="admin">Админ</option>
              </select>
            </div>
          </div>
          {usersLoading ? <div className="admin-loading"><div className="spinner"></div><span>Загрузка...</span></div>
          : users.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><h3>Не найдены</h3></div>
          : (<>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Имя</th><th>Телефон</th><th>Email</th><th>Роль</th><th>Верификация</th><th>Дата</th></tr></thead>
                  <tbody>{users.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.fullName || '—'}</strong></td><td>{u.phone}</td><td className="text-muted">{u.email || '—'}</td>
                      <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                      <td><span className={`verify-badge ${u.emailVerified ? 'yes' : 'no'}`}>{u.emailVerified ? '✅ Email' : '❌ Email'}</span> <span className={`verify-badge ${u.isVerified ? 'yes' : 'no'}`}>{u.isVerified ? '✅ SMS' : '❌ SMS'}</span></td>
                      <td className="text-muted">{fmtDate(u.createdAt)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {up > 1 && (
                <div className="pagination">
                  <button disabled={usersPage === 1} onClick={() => setUsersPage(usersPage - 1)} className="btn btn-outline">← Назад</button>
                  <span className="page-info">{usersPage} / {up}</span>
                  <button disabled={usersPage >= up} onClick={() => setUsersPage(usersPage + 1)} className="btn btn-outline">Вперед →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'queues' && (
        <div className="admin-queues">
          <h2>Системные очереди</h2>
          {queueStats ? (
            <div className="queue-card">
              <h3>📧 Очередь email</h3>
              <div className="queue-stats-grid">
                {[
                  { key: 'waiting', label: 'В ожидании', cls: 'waiting' },
                  { key: 'active', label: 'Активные', cls: 'active' },
                  { key: 'completed', label: 'Завершённые', cls: 'completed' },
                  { key: 'failed', label: 'Ошибки', cls: 'failed' },
                  { key: 'delayed', label: 'Отложенные', cls: 'delayed' },
                  { key: 'paused', label: 'Приостановленные', cls: 'paused' },
                ].map(s => (
                  <div key={s.key} className="queue-stat">
                    <div className={`queue-num ${s.cls}`}>{queueStats?.queues?.emails?.[s.key] || 0}</div>
                    <div className="queue-label">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="queue-ts">Обновлено: {new Date(queueStats.timestamp).toLocaleString()}</div>
            </div>
          ) : <div className="admin-loading"><div className="spinner"></div></div>}
        </div>
      )}
    </div>
  );
}
// placeholder