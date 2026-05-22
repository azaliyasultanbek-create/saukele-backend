import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, isAuthenticated, isCouple, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-logo">
            Saukele
          </Link>

          <div className="navbar-menu">
            <Link to="/weddings" className="navbar-link">
              Свадьбы
            </Link>

            {isAuthenticated ? (
                <>
                  {isCouple && (
                      <>
                        <Link to="/dashboard" className="navbar-link">
                          Панель
                        </Link>
                        <Link to="/wedding-profile/create" className="navbar-link">
                          Профиль свадьбы
                        </Link>
                        <Link to="/gifts/create" className="navbar-link">
                          Добавить подарок
                        </Link>
                      </>
                  )}

                  {isAdmin && (
                      <Link to="/admin" className="navbar-link">
                        Админ
                      </Link>
                  )}

                  <div className="navbar-user">
                    <span className="navbar-username">{user?.fullName}</span>
                    <button onClick={handleLogout} className="navbar-logout">
                      Выйти
                    </button>
                  </div>
                </>
            ) : (
                <>
                  <Link to="/login" className="navbar-link">
                    Войти
                  </Link>
                  <Link to="/register" className="btn btn-primary btn-small">
                    Регистрация
                  </Link>
                </>
            )}
          </div>
        </div>
      </nav>
  );
}
