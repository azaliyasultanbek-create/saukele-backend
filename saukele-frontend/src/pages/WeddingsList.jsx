import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coupleAPI } from '../services/api';
import './WeddingsList.css';

export default function WeddingsList() {
  const [weddings, setWeddings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadWeddings();
  }, [page]);

  const loadWeddings = async () => {
    try {
      const { data } = await coupleAPI.getAllWeddings(page, 12);
      setWeddings(data.weddings);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      console.error('Error loading weddings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка свадеб...</div>;
  }

  return (
    <div className="weddings-container">
      <div className="weddings-header">
        <h1>Свадьбы</h1>
        <p>Выберите свадьбу, чтобы посмотреть доступные подарки.</p>
      </div>

      {weddings.length === 0 ? (
        <div className="empty-state">
          <p>Пока нет активных свадеб</p>
        </div>
      ) : (
        <>
          <div className="weddings-grid">
            {weddings.map((wedding) => (
              <Link
                to={`/weddings/${wedding.coupleId}`}
                key={wedding.coupleId}
                className="wedding-card"
              >
                {wedding.coverPhotoUrl && (
                  <div
                    className="wedding-cover"
                    style={{ backgroundImage: `url(${wedding.coverPhotoUrl})` }}
                  />
                )}
                <div className="wedding-content">
                  <h3 className="wedding-title">
                    {wedding.coupleName} и {wedding.partner2Name}
                  </h3>
                  <div className="wedding-date">
                    {new Date(wedding.weddingDate).toLocaleDateString('ru-RU', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                  {wedding.venue && <div className="wedding-venue">{wedding.venue}</div>}
                  {wedding.story && <p className="wedding-story">{wedding.story}</p>}
                </div>
              </Link>
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
              <span className="page-info">
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
    </div>
  );
}
