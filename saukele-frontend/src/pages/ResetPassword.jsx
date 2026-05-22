import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Auth.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Пароль должен быть минимум 8 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!token) {
      setError('Ссылка для сброса пароля недействительна. Запросите новую.');
      return;
    }

    setLoading(true);

    try {
      const { data } = await authAPI.resetPassword(token, password);
      // Очищаем старые токены после сброса пароля
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setSuccess(data.message || 'Пароль успешно сброшен!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || 'Ошибка при сбросе пароля';
      if (err.response?.data?.code === 'TOKEN_EXPIRED') {
        setError('Срок действия ссылки истёк. Запросите новую.');
      } else if (err.response?.data?.code === 'TOKEN_ALREADY_USED') {
        setError('Эта ссылка уже была использована.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Недействительная ссылка</h1>
          <p className="auth-subtitle">
            Ссылка для сброса пароля отсутствует или недействительна.
          </p>
          <div className="auth-links">
            <Link to="/forgot-password">Запросить новую ссылку</Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card success">
          <h1>✅</h1>
          <h2>Пароль изменён!</h2>
          <p>{success}</p>
          <p style={{ marginTop: 20 }}>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Войти
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Новый пароль</h1>
        <p className="auth-subtitle">Придумайте новый пароль для входа в аккаунт.</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Новый пароль</label>
            <input
              type="password"
              id="password"
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Подтвердите пароль</label>
            <input
              type="password"
              id="confirmPassword"
              placeholder="Повторите пароль"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Сброс...' : 'Сбросить пароль'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Вернуться ко входу</Link>
        </div>
      </div>
    </div>
  );
}

