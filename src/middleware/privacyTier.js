/**
 * Privacy Tier Middleware
 *
 * Проверяет, что аутентифицированный пользователь имеет доступ к подарку
 * на основании его тира родства (kinship tier) и allowedTiers подарка.
 *
 * Иерархия тиров (каждый вышестоящий видит всё, что ниже):
 *   ata_ana       → видит all (ata_ana, zhien_zaran, kuda_zhekzhen)
 *   zhien_zaran   → видит zhien_zaran, kuda_zhekzhen
 *   kuda_zhekzhen → видит только kuda_zhekzhen
 *
 * Использование:
 *   router.get('/:giftId', authenticate, requirePrivacyTier, controller);
 *
 *   // Для дополнительной проверки в маршрутах со списками:
 *   router.get('/couple/:coupleId', authenticate, requirePrivacyTier({ paramSource: 'query', tierField: 'kinshipTier' }), controller);
 */

const { prisma } = require('../config/database');

// ─── Иерархия видимости тиров ────────────────────────────────────────────
// Ключ — тир пользователя, значение — какие allowedTiers он может видеть
const TIER_VISIBILITY = {
  ata_ana: ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'],
  zhien_zaran: ['zhien_zaran', 'kuda_zhekzhen'],
  kuda_zhekzhen: ['kuda_zhekzhen'],
};

// ─── Вспомогательные функции ─────────────────────────────────────────────

/**
 * Определить, виден ли подарок гостю с указанным тиром родства.
 *
 * @param {object} gift - объект подарка (должен содержать allowedTiers)
 * @param {string|null} kinshipTier - тир пользователя (ata_ana|zhien_zaran|kuda_zhekzhen)
 * @returns {boolean}
 */
function isGiftVisibleForTier(gift, kinshipTier) {
  if (!gift || !Array.isArray(gift.allowedTiers)) return false;
  if (!kinshipTier) return false;

  const visibleCategories = TIER_VISIBILITY[kinshipTier];
  if (!visibleCategories) return false;

  return gift.allowedTiers.some((tier) => visibleCategories.includes(tier));
}

/**
 * Получить тир родства пользователя для данной пары.
 *
 * @param {number} guestId
 * @param {number} coupleId
 * @param {object} [tx] - опционально для транзакции
 * @returns {Promise<string|null>} kinshipTier или null, если не найден
 */
async function getKinshipTier(guestId, coupleId, tx = prisma) {
  const familyEntry = await tx.familyTree.findFirst({
    where: {
      coupleId,
      guestId,
    },
    select: { kinshipTier: true },
  });

  return familyEntry ? familyEntry.kinshipTier : null;
}

/**
 * Проверить, является ли пользователь владельцем подарка (парой).
 *
 * @param {object} user - req.user
 * @param {number} coupleId
 * @returns {boolean}
 */
function isGiftOwner(user, coupleId) {
  return user.role === 'couple' && user.id === coupleId;
}

/**
 * Проверить, имеет ли пользователь доступ к подарку.
 * Возвращает объект с результатом и деталями.
 *
 * @param {object} user - req.user (должен содержать id, role)
 * @param {object} gift - объект подарка
 * @param {object} [options]
 * @param {object} [options.tx] - опционально для транзакции
 * @returns {Promise<{ allowed: boolean, kinshipTier: string|null, reason?: string }>}
 */
async function checkGiftAccess(user, gift, options = {}) {
  const tx = options.tx || prisma;

  // 1. Владелец (пара) всегда имеет доступ
  if (isGiftOwner(user, gift.coupleId)) {
    return { allowed: true, kinshipTier: null };
  }

  // 2. Администратор всегда имеет доступ
  if (user.role === 'admin') {
    return { allowed: true, kinshipTier: null };
  }

  // 3. Для обычных гостей проверяем тир родства
  if (user.role === 'guest') {
    const kinshipTier = await getKinshipTier(user.id, gift.coupleId, tx);

    if (!kinshipTier) {
      return {
        allowed: false,
        kinshipTier: null,
        reason: 'Вы не добавлены в родословную этой пары',
      };
    }

    const visible = isGiftVisibleForTier(gift, kinshipTier);

    if (!visible) {
      return {
        allowed: false,
        kinshipTier,
        reason: `Этот подарок недоступен для вашего тира родства (${kinshipTier})`,
      };
    }

    return { allowed: true, kinshipTier };
  }

  // Неизвестная роль
  return {
    allowed: false,
    kinshipTier: null,
    reason: 'Недостаточно прав для просмотра подарка',
  };
}

// ─── Middleware Factory ───────────────────────────────────────────────────

/**
 * Middleware для проверки доступа к подарку по тиру родства.
 *
 * Варианты использования:
 *
 * 1. Базовая проверка по giftId из параметров маршрута:
 *    router.get('/:giftId', authenticate, requirePrivacyTier, handler);
 *
 * 2. Кастомный источник ID подарка:
 *    router.post('/:someParam/contribute', authenticate, requirePrivacyTier({ giftIdSource: 'body.giftId' }), handler);
 *
 * @param {object} [options]
 * @param {string} [options.giftIdSource='params.giftId'] - откуда брать giftId
 *        ('params.giftId' | 'body.giftId' | 'query.giftId')
 * @param {boolean} [options.attachKinshipTier=true] - добавить req.kinshipTier
 * @returns {Function} middleware
 */
function requirePrivacyTier(options = {}) {
  const {
    giftIdSource = 'params.giftId',
    attachKinshipTier = true,
  } = options;

  return async (req, res, next) => {
    try {
      // Извлекаем giftId из указанного источника
      const sourceParts = giftIdSource.split('.');
      let giftId;

      if (sourceParts.length === 2) {
        const [obj, key] = sourceParts;
        giftId = req[obj]?.[key];
      } else {
        giftId = req.params.giftId || req.body.giftId || req.query.giftId;
      }

      if (!giftId) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Gift ID is required',
          timestamp: new Date().toISOString(),
        });
      }

      const parsedGiftId = parseInt(giftId, 10);
      if (Number.isNaN(parsedGiftId)) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid gift ID',
          timestamp: new Date().toISOString(),
        });
      }

      // Загружаем подарок
      const gift = await prisma.gift.findUnique({
        where: { id: parsedGiftId },
        select: {
          id: true,
          coupleId: true,
          allowedTiers: true,
          status: true,
        },
      });

      if (!gift) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: 'Gift not found',
          timestamp: new Date().toISOString(),
        });
      }

      // Проверяем доступ
      const access = await checkGiftAccess(req.user, gift);

      if (!access.allowed) {
        return res.status(403).json({
          code: 'FORBIDDEN',
          message: access.reason || 'This gift is not available for your kinship tier',
          timestamp: new Date().toISOString(),
        });
      }

      // Прикрепляем информацию к запросу для последующего использования
      if (attachKinshipTier) {
        req.kinshipTier = access.kinshipTier;
      }
      req.gift = gift; // для дальнейшего использования в контроллерах

      next();
    } catch (error) {
      console.error('Privacy tier middleware error:', error);
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to check gift access',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

module.exports = {
  requirePrivacyTier,
  checkGiftAccess,
  isGiftVisibleForTier,
  getKinshipTier,
  isGiftOwner,
  TIER_VISIBILITY,
};
