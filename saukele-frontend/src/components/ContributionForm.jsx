import { useState } from 'react';
import { contributionAPI } from '../services/api';
import './ContributionForm.css';

export default function ContributionForm({ giftId, giftCurrency, maxAmount, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'KZT',
    isAnonymous: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Примерные курсы (должны совпадать с серверными)
  const RATES_TO_KZT = { KZT: 1, USD: 460, EUR: 500 };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await contributionAPI.create({
        giftId: parseInt(giftId),
        amount: parseInt(formData.amount),
        currency: formData.currency,
        isAnonymous: formData.isAnonymous,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка создания вклада');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contribution-form">
      <h3>Внести вклад</h3>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="amount">Сумма *</label>
            <input
              type="number"
              id="amount"
              name="amount"
              max={maxAmount}
              placeholder="10000"
              value={formData.amount}
              onChange={handleChange}
              required
            />
            <small>Макс: {maxAmount?.toLocaleString()} {giftCurrency}</small>
          </div>

          <div className="form-group">
            <label htmlFor="currency">Валюта платежа</label>
            <select id="currency" name="currency" value={formData.currency} onChange={handleChange}>
              <option value="KZT">₸ Тенге</option>
              <option value="USD">$ Доллар</option>
              <option value="EUR">€ Евро</option>
            </select>
            <small>Сумма конвертируется в {giftCurrency} по текущему курсу</small>
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="isAnonymous"
              checked={formData.isAnonymous}
              onChange={handleChange}
            />
            Анонимный вклад
          </label>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Отправка...' : 'Внести вклад'}
          </button>
        </div>
      </form>
    </div>
  );
}

