import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

export default function Home() {
  const { isAuthenticated, isCouple, isGuest } = useAuth();

  return (
    <div className="home-container">
      <section className="hero">
        <h1 className="hero-title">Saukele</h1>
        <p className="hero-subtitle">Платформа для свадебных подарков</p>
        <p className="hero-description">
          Создавайте списки желаний для вашей свадьбы и позвольте гостям внести вклад в подарки
          вашей мечты
        </p>

        <div className="hero-actions">
          {!isAuthenticated ? (
            <>
              <Link to="/register" className="btn btn-primary btn-large">
                Начать
              </Link>
              <Link to="/login" className="btn btn-secondary btn-large">
                Войти
              </Link>
            </>
          ) : isCouple ? (
            <Link to="/dashboard" className="btn btn-primary btn-large">
              Моя панель
            </Link>
          ) : (
            <Link to="/weddings" className="btn btn-primary btn-large">
              Посмотреть свадьбы
            </Link>
          )}
        </div>
      </section>

      <section className="features">
        <div className="feature">
          <div className="feature-icon">💝</div>
          <h3>Создайте список желаний</h3>
          <p>Добавьте подарки, которые вы хотите получить на свадьбу</p>
        </div>

        <div className="feature">
          <div className="feature-icon">👨‍👩‍👧‍👦</div>
          <h3>Управление семьёй</h3>
          <p>Настройте видимость подарков для разных уровней родства</p>
        </div>

        <div className="feature">
          <div className="feature-icon">💰</div>
          <h3>Гибкие вклады</h3>
          <p>Гости могут вносить вклады в любой валюте с автоконвертацией</p>
        </div>
      </section>

      <section className="cta">
        <h2>Готовы начать?</h2>
        <Link to="/weddings" className="btn btn-primary btn-large">
          Посмотреть свадьбы
        </Link>
      </section>
    </div>
  );
}
