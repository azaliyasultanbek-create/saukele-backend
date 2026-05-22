import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { coupleAPI, familyAPI, giftAPI } from '../services/api';
import './Dashboard.css';

const tierLabels = {
  ata_ana: 'Ата-ана (родители и старшие)',
  zhien_zaran: 'Жиен-жаран (родственники по линии матери)',
  kuda_zhekzhen: 'Құда-жекжең (сваты/кумовья)',
};

export default function CoupleDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [familyForm, setFamilyForm] = useState({ guestPhone: '', kinshipTier: 'ata_ana', parentId: '' });
  const [treeData, setTreeData] = useState(null);
  const [familyMessage, setFamilyMessage] = useState('');

  useEffect(() => {
    loadDashboard();
  }, [page]);

  const loadDashboard = async () => {
    setLoading(true);

    try {
      const profileResponse = await coupleAPI.getProfile(user.id);
      setProfile(profileResponse.data.profile);
      setProfileMissing(false);

      const { data } = await giftAPI.getAll(page, 10);
      setGifts(data.gifts);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      if (error.response?.status === 404) {
        setProfileMissing(true);
        setGifts([]);
      } else {
        console.error('Error loading dashboard:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (giftId) => {
    if (!confirm('Вы уверены, что хотите удалить этот подарок?')) return;

    try {
      await giftAPI.delete(giftId);
      loadDashboard();
    } catch (error) {
      alert(error.response?.data?.message || 'Ошибка удаления');
    }
  };

  const handleFamilySubmit = async (e) => {
    e.preventDefault();
    setFamilyMessage('');

    try {
      const payload = {
        guestPhone: familyForm.guestPhone,
        kinshipTier: familyForm.kinshipTier,
      };
      if (familyForm.parentId) {
        payload.parentId = parseInt(familyForm.parentId, 10);
      }
      const { data } = await familyAPI.addMember(payload);
      setFamilyMessage(`${data.member.guestName} добавлен как: ${tierLabels[data.member.kinshipTier] || data.member.kinshipTier}`);
      setFamilyForm({ guestPhone: '', kinshipTier: 'ata_ana', parentId: '' });
    } catch (error) {
      setFamilyMessage(error.response?.data?.message || 'Не удалось добавить гостя.');
    }
  };

  const loadFamilyTree = async () => {
    try {
      const { data } = await familyAPI.getTree(user.id);
      setTreeData(data);
    } catch (error) {
      console.error('Ошибка загрузки генеалогического древа:', error);
    }
  };

  // Рекурсивный рендер узла дерева
  const renderTreeNode = (node, depth = 0) => (
    <li key={node.id} className="tree-node" style={{ paddingLeft: `${depth * 20}px` }}>
      <div className="tree-node-content">
        <span className="tree-node-name">{node.guestName || '—'}</span>
        <span className="tree-node-tier">{tierLabels[node.kinshipTier] || node.kinshipTier}</span>
        {node.guestPhone && <span className="tree-node-phone">{node.guestPhone}</span>}
      </div>
      {node.children && node.children.length > 0 && (
        <ul className="tree-children">
          {node.children.map(child => renderTreeNode(child, depth + 1))}
        </ul>
      )}
    </li>
  );

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  if (profileMissing) {
    return (
      <div className="dashboard-container">
        <div className="setup-state">
          <p className="eyebrow">Первый шаг</p>
          <h1>Создайте профиль свадьбы</h1>
          <p>
            Перед добавлением подарков нужно указать дату, место и данные пары.
            После этого гости смогут увидеть вашу свадьбу и список подарков.
          </p>
          <Link to="/wedding-profile/create" className="btn btn-primary">
            Создать профиль свадьбы
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Панель пары</p>
          <h1>Мои подарки</h1>
          {profile && (
            <p className="dashboard-subtitle">
              {profile.user?.fullName} и {profile.partner2Name}
            </p>
          )}
        </div>

        <div className="dashboard-actions">
          <Link to="/wedding-profile/create" className="btn btn-secondary">
            Профиль свадьбы
          </Link>
          <Link to="/gifts/create" className="btn btn-primary">
            Добавить подарок
          </Link>
        </div>
      </div>

      {gifts.length === 0 ? (
        <div className="empty-state">
          <h2>Подарков пока нет</h2>
          <p>Создайте первый подарок, чтобы гости могли внести вклад.</p>
          <Link to="/gifts/create" className="btn btn-primary">
            Создать первый подарок
          </Link>
        </div>
      ) : (
        <>
          <div className="gifts-grid">
            {gifts.map((gift) => (
              <div key={gift.id} className="gift-card">
                <div className="gift-header">
                  <h3>{gift.name}</h3>
                  <span className={`status status-${gift.status}`}>{gift.status}</span>
                </div>

                <p className="gift-description">{gift.description || 'Описание не добавлено'}</p>

                <div className="gift-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(gift.progressPercent, 100)}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    {gift.fundedAmount.toLocaleString()} / {gift.targetAmount.toLocaleString()}{' '}
                    {gift.currency}
                  </div>
                  <div className="progress-percent">{gift.progressPercent.toFixed(1)}%</div>
                </div>

                <div className="gift-actions">
                  <Link to={`/gifts/${gift.id}`} className="btn btn-secondary">
                    Детали
                  </Link>
                  <button
                    onClick={() => handleDelete(gift.id)}
                    className="btn btn-danger"
                    disabled={gift.fundedAmount > 0}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="btn btn-secondary"
              >
                Назад
              </button>
              <span>
                Страница {page} из {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="btn btn-secondary"
              >
                Вперед
              </button>
            </div>
          )}
        </>
      )}

      {user?.role === 'couple' && (
        <section className="family-access-panel">
          <div>
            <p className="eyebrow">Доступ гостей</p>
            <h2>Родство и видимость подарков</h2>
            <p>
              Добавьте зарегистрированного гостя по телефону и выберите его родство.
              Гость увидит только подарки, где при создании отмечена эта группа.
            </p>
          </div>

          <form onSubmit={handleFamilySubmit} className="family-access-form">
            <div className="form-group">
              <label htmlFor="guestPhone">Телефон гостя</label>
              <input
                id="guestPhone"
                type="tel"
                placeholder="77071234567"
                value={familyForm.guestPhone}
                onChange={(e) => setFamilyForm((prev) => ({ ...prev, guestPhone: e.target.value }))}
                pattern="^7[0-9]{10}$"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="kinshipTier">Родство</label>
              <select
                id="kinshipTier"
                value={familyForm.kinshipTier}
                onChange={(e) => setFamilyForm((prev) => ({ ...prev, kinshipTier: e.target.value }))}
              >
                {Object.entries(tierLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary">
              Добавить гостя
            </button>
          </form>

          {familyMessage && <div className="success-message">{familyMessage}</div>}

          <div className="tree-section">
            <div className="tree-header">
              <h3>Генеалогическое древо</h3>
              <button type="button" className="btn btn-secondary" onClick={loadFamilyTree}>
                Загрузить древо
              </button>
            </div>

            {treeData && (
              <div className="tree-container">
                <div className="tree-meta">
                  <p>Всего родственников: <strong>{treeData.meta?.totalMembers || 0}</strong></p>
                  <div className="tree-category-counts">
                    <span>👴 Ата-ана: {treeData.meta?.categories?.ATA_ANA || 0}</span>
                    <span>👩 Жиен-жаран: {treeData.meta?.categories?.ZHIEN_ZhARAN || 0}</span>
                    <span>🤝 Құда-жекжең: {treeData.meta?.categories?.KUDA_ZHEKZhEN || 0}</span>
                  </div>
                </div>

                {treeData.groupedByCategory && treeData.groupedByCategory.map(cat => (
                  <div key={cat.category} className="tree-category-section">
                    <h4>{cat.label} ({cat.members.length})</h4>
                    {cat.members.length > 0 ? (
                      <ul className="tree-category-list">
                        {cat.members.map(m => (
                          <li key={m.id} className="tree-category-member">
                            <span>{m.guestName || '—'}</span>
                            <small>{m.guestPhone}</small>
                            <span className="tree-node-tier">{tierLabels[m.kinshipTier] || m.kinshipTier}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted">Нет родственников в этой категории</p>
                    )}
                  </div>
                ))}

                {treeData.tree && treeData.tree.length > 0 && (
                  <div className="tree-hierarchy">
                    <h4>Иерархия</h4>
                    <ul className="tree-root">
                      {treeData.tree.map(node => renderTreeNode(node))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
