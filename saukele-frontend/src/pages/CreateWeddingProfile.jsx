import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { coupleAPI } from '../services/api';
import './WeddingProfile.css';

export default function CreateWeddingProfile() {
  const [formData, setFormData] = useState({
    partner2Name: '',
    weddingDate: '',
    venue: '',
    story: '',
    coverPhotoUrl: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        partner2Name: formData.partner2Name.trim(),
        weddingDate: formData.weddingDate,
        venue: formData.venue.trim() || null,
        story: formData.story.trim() || null,
        coverPhotoUrl: formData.coverPhotoUrl.trim() || null,
      };

      await coupleAPI.createProfile(payload);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 409) {
        setError('Профиль свадьбы уже создан для этого аккаунта.');
      } else if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setError('Сначала подтвердите email, затем создайте профиль свадьбы.');
      } else {
        setError(err.response?.data?.message || 'Не удалось создать профиль свадьбы.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wedding-profile-container">
      <section className="wedding-profile-card">
        <div className="wedding-profile-header">
          <p className="eyebrow">Профиль пары</p>
          <h1>Создать профиль свадьбы</h1>
          <p className="subtitle">
            Эти данные будут видны гостям в списке свадеб и на странице подарков.
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="wedding-profile-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="partner2Name">Имя второго партнера *</label>
              <input
                type="text"
                id="partner2Name"
                name="partner2Name"
                placeholder="Например: Аружан"
                value={formData.partner2Name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="weddingDate">Дата свадьбы *</label>
              <input
                type="date"
                id="weddingDate"
                name="weddingDate"
                value={formData.weddingDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="venue">Место проведения</label>
            <input
              type="text"
              id="venue"
              name="venue"
              placeholder="Например: Алматы, ресторан Arman"
              value={formData.venue}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="story">История пары</label>
            <textarea
              id="story"
              name="story"
              rows="5"
              placeholder="Коротко расскажите гостям о вашей истории или о формате свадьбы"
              value={formData.story}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="coverPhotoUrl">Ссылка на фото обложки</label>
            <input
              type="url"
              id="coverPhotoUrl"
              name="coverPhotoUrl"
              placeholder="https://example.com/photo.jpg"
              value={formData.coverPhotoUrl}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions">
            <Link to="/dashboard" className="btn btn-secondary">
              Отмена
            </Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Создание...' : 'Создать профиль'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
