import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { giftAPI } from '../services/api';
import './GiftForm.css';

const tierOptions = [
  { value: 'ata_ana', label: 'Ата-ана (родители и старшие)' },
  { value: 'zhien_zaran', label: 'Жиен-жаран (родственники по линии матери)' },
  { value: 'kuda_zhekzhen', label: 'Құда-жекжең (сваты/кумовья)' },
];

export default function CreateGift() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetAmount: '',
    currency: 'KZT',
    allowedTiers: ['parents', 'siblings', 'nephews', 'distant'],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        allowedTiers: checked
          ? [...prev.allowedTiers, value]
          : prev.allowedTiers.filter((tier) => tier !== value),
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.allowedTiers.length === 0) {
      setError('Выберите хотя бы одну группу родства, которая сможет видеть подарок.');
      return;
    }

    setLoading(true);

    try {
      await giftAPI.create({
        ...formData,
        targetAmount: parseInt(formData.targetAmount, 10),
      });
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Сначала создайте профиль свадьбы, затем добавьте подарок.');
      } else {
        setError(err.response?.data?.message || 'Не удалось создать подарок.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gift-form-container">
      <div className="gift-form-card">
        <h1>Создать подарок</h1>
        <p className="subtitle">Добавьте подарок и выберите, какие родственники смогут его увидеть.</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Название подарка *</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Например: холодильник Samsung"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Описание</label>
            <textarea
              id="description"
              name="description"
              rows="3"
              placeholder="Опишите подарок или добавьте пожелания для гостей"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="targetAmount">Целевая сумма *</label>
              <input
                type="number"
                id="targetAmount"
                name="targetAmount"
                min="1000"
                placeholder="50000"
                value={formData.targetAmount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="currency">Валюта</label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="KZT">Тенге (KZT)</option>
                <option value="USD">Доллар (USD)</option>
                <option value="EUR">Евро (EUR)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Кому показывать этот подарок?</label>
            <p className="form-hint">
              Гость увидит подарок только если пара добавила его телефон в эту группу родства.
            </p>
            <div className="checkbox-group">
              {tierOptions.map((tier) => (
                <label key={tier.value} className="checkbox-label">
                  <input
                    type="checkbox"
                    value={tier.value}
                    checked={formData.allowedTiers.includes(tier.value)}
                    onChange={handleChange}
                  />
                  {tier.label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn btn-secondary"
            >
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Создание...' : 'Создать подарок'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
