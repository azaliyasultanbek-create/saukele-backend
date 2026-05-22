import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { coupleAPI, giftAPI } from '../services/api';
import './WeddingDetails.css';

export default function WeddingDetails() {
  const { coupleId } = useParams();
  const { isAuthenticated } = useAuth();

  const [profile, setProfile] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWeddingDetails();
  }, [coupleId]);

  const loadWeddingDetails = async () => {
    setLoading(true);
    setError('');

    try {
      const profileRes = await coupleAPI.getProfile(coupleId);
      setProfile(profileRes.data.profile);

      const giftsRes = await giftAPI.getByCouple(coupleId, 1, 50);
      setGifts(giftsRes.data.gifts || []);
    } catch (err) {
      console.error('Ошибка загрузки страницы свадьбы:', err);
      setError(err.response?.data?.message || 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="wedding-details-loading">
        <div className="spinner"></div>
        <span>Загрузка...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wedding-details-error">
        <p className="error-message">{error}</p>
        <Link to="/weddings" className="btn btn-outline">← К списку свадеб</Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="wedding-details-error">
        <p className="error-message">Профиль свадьбы не найден</p>
        <Link to="/weddings" className="btn btn-outline">← К списку свадеб</Link>
      </div>
    );
  }

  return (
    <div className="wedding-details-page">
      <div className="wedding-details-header">
        <div className="wedding-avatar-lg">
          {profile.user?.fullName?.[0] || '?'}
        </div>
        <div className="wedding-couple-info">
          <h1>{profile.user?.fullName} & {profile.partner2Name}</h1>
          <p className="wedding-meta">
            {profile.weddingDate && (
              <span>📅 {new Date(profile.weddingDate).toLocaleDateString('ru-RU', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}</span>
            )}
            {profile.venue && <span> 📍 {profile.venue}</span>}
          </p>
          {profile.story && (
            <div className="wedding-story">
              <h3>📖 Наша история</h3>
              <p>{profile.story}</p>
            </div>
          )}
        </div>
      </div>

      <section className="wedding-gifts-section">
        <h2>🎁 Список подарков</h2>

        {gifts.length === 0 ? (
          <div className="empty-state">
            <p>Подарков пока нет</p>
          </div>
        ) : (
          <div className="gifts-grid">
            {gifts.map((gift) => (
              <div key={gift.id} className="gift-card">
                <div className="gift-header">
                  <h3>{gift.name}</h3>
                  <span className={`status status-${gift.status}`}>
                    {gift.status === 'active' ? 'Активен' : gift.status === 'funded' ? 'Собран' : gift.status === 'delivered' ? 'Доставлен' : gift.status}
                  </span>
                </div>

                {gift.description && (
                  <p className="gift-description">{gift.description}</p>
                )}

                <div className="gift-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(gift.progressPercent || 0, 100)}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    <span>{(gift.fundedAmount || 0).toLocaleString()} / {gift.targetAmount.toLocaleString()} {gift.currency}</span>
                    <span className="progress-percent">{(gift.progressPercent || 0).toFixed(1)}%</span>
                  </div>
                </div>

                {isAuthenticated && (
                  <div className="gift-actions">
                    <Link to={`/gifts/${gift.id}`} className="btn btn-primary">
                      Внести вклад
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
