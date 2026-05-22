

const { prisma } = require('../config/database');


const TIER_VISIBILITY = {
  ata_ana: ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'],
  zhien_zaran: ['zhien_zaran', 'kuda_zhekzhen'],
  kuda_zhekzhen: ['kuda_zhekzhen'],
};



/**
 
 * @param {object} gift 
 * @param {string|null} kinshipTier 
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
 
 * @param {number} guestId
 * @param {number} coupleId
 * @param {object} [tx] 
 * @returns {Promise<string|null>} 
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
 
 * @param {object} user - req.user
 * @param {number} coupleId
 * @returns {boolean}
 */
function isGiftOwner(user, coupleId) {
  return user.role === 'couple' && user.id === coupleId;
}

/**
 
 * @param {object} user 
 * @param {object} gift 
 * @param {object} [options]
 * @param {object} [options.tx] 
 * @returns {Promise<{ allowed: boolean, kinshipTier: string|null, reason?: string }>}
 */
async function checkGiftAccess(user, gift, options = {}) {
  const tx = options.tx || prisma;

  
  if (isGiftOwner(user, gift.coupleId)) {
    return { allowed: true, kinshipTier: null };
  }

  
  if (user.role === 'admin') {
    return { allowed: true, kinshipTier: null };
  }

  
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

  
  return {
    allowed: false,
    kinshipTier: null,
    reason: 'Недостаточно прав для просмотра подарка',
  };
}



/**
 
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

      const access = await checkGiftAccess(req.user, gift);

      if (!access.allowed) {
        return res.status(403).json({
          code: 'FORBIDDEN',
          message: access.reason || 'This gift is not available for your kinship tier',
          timestamp: new Date().toISOString(),
        });
      }

    
      if (attachKinshipTier) {
        req.kinshipTier = access.kinshipTier;
      }
      req.gift = gift; 

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
