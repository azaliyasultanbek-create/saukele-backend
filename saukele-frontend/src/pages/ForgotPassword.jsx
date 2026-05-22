import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await authAPI.forgotPassword(email);
      setSuccess(data.message || 'Если аккаунт существует, письмо для сброса пароля отправлено.');
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка при отправке запроса');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card success">
          <h1>✉️</h1>
          <h2>Проверьте почту</h2>
          <p>{success}</p>
          <p style={{ marginTop: 20 }}>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Вернуться ко входу
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Сброс пароля</h1>
        <p className="auth-subtitle">
          Введите email, привязанный к аккаунту. Мы отправим ссылку для сброса пароля.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Отправка...' : 'Отправить ссылку'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Вспомнили пароль? Войти</Link>
        </div>
      </div>
    </div>
  );
}
