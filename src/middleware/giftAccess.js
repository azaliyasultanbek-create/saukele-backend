/**
 * Gift Access Middleware (Dependency Injection-стиль)
 *
 ========================================================
 * КАСТОМНЫЙ СЛОЙ ПРОВЕРКИ ПРАВ (DI-стиль)
 *
 * В отличие от requirePrivacyTier (который сам загружает gift
 * по giftId из params/body/query), этот middleware:
 *
 *   1) ПРИНИМАЕТ УЖЕ ЗАГРУЖЕННЫЙ gift объект из req.gift
 *      (инъекция зависимости — DI)
 *   2) Работает с НЕАВТОРИЗОВАННЫМИ пользователями:
 *      — Если пользователь не аутентифицирован (req.user нет) —
 *        возвращает 403 Forbidden
 *      — Если пользователь — гость, не добавленный в родословную
 *        пары, или его тир родства не позволяет видеть подарок —
 *        возвращает 403 Forbidden
 *
 * Использование:
 *
 *   // В роуте:
 *   router.get(
 *     '/:giftId/details',
 *     loadGift,               // ← загружает gift в req.gift
 *     requireGiftAccess,      // ← проверяет доступ через req.gift
 *     handler
 *   );
 *
 *   // Или более коротко (всё в одном):
 *   router.get(
 *     '/:giftId',
 *     authenticate,                    // опционально — если нужно,
 *     loadGift,                        // но можно не требовать JWT
 *     requireGiftAccess,
 *     handler
 *   );
 *
 * Поток данных:
 *   req (request) → loadGift → req.gift = { ... }
 *   req (request) → requireGiftAccess → 200/403
 *   req (request) → handler(req, res)
 *
 * Преимущества DI-стиля:
 *   - Тестируемость: можно протестировать middleware изолированно,
 *     подставив мокнутый req.gift
 *   - Повторное использование: один раз загрузили gift — используем
 *     в нескольких middlewares и контроллере
 *   - Разделение ответственности: loadGift только загружает данные,
 *     requireGiftAccess только проверяет права
 *   - Гибкость: можно загрузить gift с любыми включениями (includes)
 *     перед проверкой прав
 */

const { prisma } = require('../config/database');

// ─── Иерархия видимости тиров ────────────────────────────────────────────
const TIER_VISIBILITY = {
  ata_ana: ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'],
  zhien_zaran: ['zhien_zaran', 'kuda_zhekzhen'],
  kuda_zhekzhen: ['kuda_zhekzhen'],
};

// ─── DI: Проверка доступа к подарку ──────────────────────────────────────

/**
 * Middleware: requireGiftAccess
 *
 * ПРОВЕРЯЕТ доступ к ПОДАРКУ, который УЖЕ загружен в req.gift
 * (Dependency Injection-стиль).
 *
 * Если req.gift отсутствует — отвечает 500 (ошибка конфигурации роута).
 * Если пользователь не аутентифицирован — 403 Forbidden.
 * Если пользователь — гость без доступа — 403 Forbidden.
 *
 * @param {object} [options]
 * @param {boolean} [options.allowPublicGifts=true] - разрешить публичные подарки
 *        (gift.allowedTiers содержит все три тира) для неаутентифицированных
 * @param {Function} [options.onForbidden] - кастомный обработчик для 403
 * @returns {Function} middleware
 */
function requireGiftAccess(options = {}) {
  const {
    allowPublicGifts = true,
    onForbidden,
  } = options;

  return async (req, res, next) => {
    try {
      // ── Проверка: gift должен быть загружен в req.gift ──────────
      if (!req.gift) {
        console.error('[requireGiftAccess] req.gift is undefined. Did you forget to use loadGift middleware before this?');
        return res.status(500).json({
          code: 'CONFIG_ERROR',
          message: 'Gift access middleware misconfigured: gift not loaded',
          timestamp: new Date().toISOString(),
        });
      }

      const { gift } = req;

      // ── 1. НЕАВТОРИЗОВАННЫЙ пользователь ────────────────────────
      if (!req.user) {
        // Если подарок публичный (доступен всем тирам) — пускаем
        if (allowPublicGifts && isGiftPublic(gift)) {
          return next();
        }

        // Иначе — 403 Forbidden
        const errorResponse = {
          code: 'FORBIDDEN',
          message: 'Authentication required. Please log in to view this gift.',
          timestamp: new Date().toISOString(),
        };

        if (onForbidden) {
          return onForbidden(req, res, errorResponse);
        }

        return res.status(403).json(errorResponse);
      }

      // ── 2. АУТЕНТИФИЦИРОВАННЫЙ пользователь ─────────────────────
      const { user } = req;

      // Администратор всегда имеет доступ
      if (user.role === 'admin') {
        return next();
      }

      // Владелец (пара) всегда имеет доступ
      if (user.role === 'couple' && user.id === gift.coupleId) {
        req.kinshipTier = null;
        return next();
      }

      // Гость — проверяем через родословную
      if (user.role === 'guest') {
        const familyEntry = await prisma.familyTree.findFirst({
          where: {
            coupleId: gift.coupleId,
            guestId: user.id,
          },
          select: { kinshipTier: true },
        });

        if (!familyEntry) {
          const errorResponse = {
            code: 'FORBIDDEN',
            message: 'Вы не добавлены в родословную этой пары. Попросите пару добавить вас.',
            timestamp: new Date().toISOString(),
          };

          if (onForbidden) {
            return onForbidden(req, res, errorResponse);
          }

          return res.status(403).json(errorResponse);
        }

        const { kinshipTier } = familyEntry;
        const visibleCategories = TIER_VISIBILITY[kinshipTier];

        if (!visibleCategories) {
          return res.status(403).json({
            code: 'FORBIDDEN',
            message: `Неизвестный тир родства: ${kinshipTier}`,
            timestamp: new Date().toISOString(),
          });
        }

        const hasAccess = Array.isArray(gift.allowedTiers) &&
          gift.allowedTiers.some((tier) => visibleCategories.includes(tier));

        if (!hasAccess) {
          const errorResponse = {
            code: 'FORBIDDEN',
            message: `Этот подарок недоступен для вашего тира родства (${kinshipTier}).`,
            timestamp: new Date().toISOString(),
          };

          if (onForbidden) {
            return onForbidden(req, res, errorResponse);
          }

          return res.status(403).json(errorResponse);
        }

        // Доступ разрешён — прикрепляем тир к запросу
        req.kinshipTier = kinshipTier;
        return next();
      }

      // Неизвестная роль — 403
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для просмотра подарка.',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[requireGiftAccess] Error:', error);
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to check gift access permissions',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// ─── DI: Загрузка подарка ────────────────────────────────────────────────

/**
 * Middleware: loadGift
 *
 * Загружает подарок по ID из указанного источника и помещает
 * результат в req.gift (Dependency Injection-стиль).
 *
 * Это ЧИСТЫЙ загрузчик данных — без проверки прав.
 * Используйте requireGiftAccess после него для проверки прав.
 *
 * @param {object} [options]
 * @param {string} [options.giftIdSource='params.giftId'] - откуда брать giftId
 *        ('params.giftId' | 'body.giftId' | 'query.giftId')
 * @param {object} [options.select] - какие поля выбрать (Prisma select)
 * @param {boolean} [options.required=true] - если true, 404 при отсутствии подарка
 * @param {Function} [options.onNotFound] - кастомный обработчик 404
 * @returns {Function} middleware
 */
function loadGift(options = {}) {
  const {
    giftIdSource = 'params.giftId',
    select = {
      id: true,
      coupleId: true,
      name: true,
      description: true,
      targetAmount: true,
      fundedAmount: true,
      currency: true,
      status: true,
      allowedTiers: true,
      imageUrls: true,
      handlingFlags: true,
      createdAt: true,
      updatedAt: true,
    },
    required = true,
    onNotFound,
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
          message: 'Invalid gift ID format',
          timestamp: new Date().toISOString(),
        });
      }

      const gift = await prisma.gift.findUnique({
        where: { id: parsedGiftId },
        select,
      });

      if (!gift) {
        if (!required) {
          req.gift = null;
          return next();
        }

        const errorResponse = {
          code: 'NOT_FOUND',
          message: 'Gift not found',
          timestamp: new Date().toISOString(),
        };

        if (onNotFound) {
          return onNotFound(req, res, errorResponse);
        }

        return res.status(404).json(errorResponse);
      }

      // DI: Инъекция загруженного подарка в req
      req.gift = gift;
      next();
    } catch (error) {
      console.error('[loadGift] Error:', error);
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to load gift data',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// ─── DI: Комбинированный middleware "загрузить + проверить" ──────────────

/**
 * Middleware: loadAndCheckGiftAccess
 *
 * Комбинирует loadGift + requireGiftAccess в одном middleware.
 * Удобно для простых случаев, когда не нужно разделять загрузку и проверку.
 *
 * Использование:
 *   router.get('/:giftId', authenticate, loadAndCheckGiftAccess(), handler);
 *
 * @param {object} [loadOptions] - опции для loadGift
 * @param {object} [accessOptions] - опции для requireGiftAccess
 * @returns {Function[]} [loadGift, requireGiftAccess]
 */
function loadAndCheckGiftAccess(loadOptions = {}, accessOptions = {}) {
  return [
    loadGift(loadOptions),
    requireGiftAccess(accessOptions),
  ];
}

// ─── Вспомогательные функции ─────────────────────────────────────────────

/**
 * Проверить, является ли подарок публичным (доступен всем тирам).
 *
 * @param {object} gift - объект подарка с allowedTiers
 * @returns {boolean}
 */
function isGiftPublic(gift) {
  if (!Array.isArray(gift.allowedTiers)) return false;
  const allTiers = ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'];
  return allTiers.every((tier) => gift.allowedTiers.includes(tier));
}

/**
 * Получить тир родства пользователя для данной пары.
 * (переиспользуемая функция для других middleware/сервисов)
 *
 * @param {number} guestId
 * @param {number} coupleId
 * @param {object} [tx] - опционально для транзакции
 * @returns {Promise<string|null>}
 */
async function getKinshipTier(guestId, coupleId, tx = prisma) {
  const familyEntry = await tx.familyTree.findFirst({
    where: { coupleId, guestId },
    select: { kinshipTier: true },
  });
  return familyEntry ? familyEntry.kinshipTier : null;
}

module.exports = {
  requireGiftAccess,
  loadGift,
  loadAndCheckGiftAccess,
  getKinshipTier,
  isGiftPublic,
  TIER_VISIBILITY,
};
