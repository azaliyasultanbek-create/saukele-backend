import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { giftAPI, contributionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ContributionForm from '../components/ContributionForm';
import './GiftDetails.css';

export default function GiftDetails() {
  const { giftId } = useParams();
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [gift, setGift] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showContributionForm, setShowContributionForm] = useState(false);

  useEffect(() => {
    loadGiftData();
  }, [giftId]);

  const loadGiftData = async () => {
    try {
      const [giftRes, contribRes] = await Promise.all([
        giftAPI.getById(giftId),
        contributionAPI.getByGift(giftId, 1, 20),
      ]);

      setGift(giftRes.data.gift);
      setContributions(contribRes.data.contributions);
    } catch (error) {
      console.error('Error loading gift:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleContributionSuccess = () => {
    setShowContributionForm(false);
    loadGiftData();
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  if (!gift) {
    return <div className="error">Подарок не найден</div>;
  }

  const canContribute = isGuest && gift.status !== 'funded' && gift.status !== 'paid_out';

  return (
    <div className="gift-details-container">
      <div className="gift-details-main">
        <div className="gift-header">
          <h1>{gift.name}</h1>
          <span className={`status status-${gift.status}`}>{gift.status}</span>
        </div>

        {gift.description && <p className="gift-description">{gift.description}</p>}

        <div className="gift-stats">
          <div className="stat">
            <span className="stat-label">Цель</span>
            <span className="stat-value">
              {gift.targetAmount.toLocaleString()} {gift.currency}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Собрано</span>
            <span className="stat-value">
              {gift.fundedAmount.toLocaleString()} {gift.currency}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Осталось</span>
            <span className="stat-value">
              {gift.remainingAmount.toLocaleString()} {gift.currency}
            </span>
          </div>
        </div>

        <div className="gift-progress">
          <div className="progress-bar-large">
            <div className="progress-fill" style={{ width: `${gift.progressPercent}%` }} />
          </div>
          <div className="progress-percent-large">{gift.progressPercent.toFixed(1)}%</div>
        </div>

        {canContribute && (
          <div className="contribute-section">
            {!showContributionForm ? (
              <button
                onClick={() => setShowContributionForm(true)}
                className="btn btn-primary btn-large"
              >
                💝 Внести вклад
              </button>
            ) : (
              <ContributionForm
                giftId={gift.id}
                giftCurrency={gift.currency}
                maxAmount={gift.remainingAmount}
                onSuccess={handleContributionSuccess}
                onCancel={() => setShowContributionForm(false)}
              />
            )}
          </div>
        )}
      </div>

      <div className="contributions-sidebar">
        <h2>Вклады ({contributions.length})</h2>
        {contributions.length === 0 ? (
          <p className="empty-contributions">Пока нет вкладов</p>
        ) : (
          <div className="contributions-list">
            {contributions.map((contrib) => (
              <div key={contrib.id} className="contribution-item">
                <div className="contribution-avatar">{contrib.guestName[0]}</div>
                <div className="contribution-info">
                  <div className="contribution-name">{contrib.guestName}</div>
                  <div className="contribution-amount">
                    {contrib.amount.toLocaleString()} {gift.currency}
                    {contrib.originalCurrency !== gift.currency && (
                      <span className="original-amount">
                        ({contrib.originalAmount} {contrib.originalCurrency})
                      </span>
                    )}
                  </div>
                  <div className="contribution-date">
                    {new Date(contrib.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

