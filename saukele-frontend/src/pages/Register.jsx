import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    password: '',
    fullName: '',
    role: 'couple',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(formData);
      setSuccess(true);
      setTimeout(() => navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card success">
          <h1>Регистрация успешна</h1>
          <p>Проверьте email и введите код подтверждения.</p>
          <p>Перенаправление на подтверждение email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Регистрация</h1>
        <p className="auth-subtitle">Создайте аккаунт в Saukele</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="role">Тип аккаунта</label>
            <select id="role" name="role" value={formData.role} onChange={handleChange}>
              <option value="couple">Пара: создаю свадьбу и подарки</option>
              <option value="guest">Гость: хочу смотреть подарки и делать вклад</option>
            </select>
            <small>
              Для создания wedding profile и подарков нужен аккаунт пары.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="fullName">Полное имя</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              placeholder="Иван Иванов"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Телефон</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              placeholder="77071234567"
              value={formData.phone}
              onChange={handleChange}
              pattern="^7[0-9]{10}$"
              required
            />
            <small>Начинается с 7, всего 11 цифр</small>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="example@mail.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Минимум 8 символов"
              value={formData.password}
              onChange={handleChange}
              minLength="8"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="auth-links">
          <span>Уже есть аккаунт?</span>
          <Link to="/login">Войти</Link>
        </div>
      </div>
    </div>
  );
}
