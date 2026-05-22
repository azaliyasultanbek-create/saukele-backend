const { prisma } = require('../config/database');
const { formatAmount } = require('../services/currencyService');
const {
  validateHandlingFlags,
  annotateFlags,
  buildDeliveryNote,
  getPackagingRequirements,
  ALL_VALID_FLAGS,
} = require('../services/handlingFlagsService');

const VALID_CURRENCIES = ['KZT', 'EUR', 'USD'];
const VALID_TIERS = ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'];
const TIER_VISIBILITY = {
  ata_ana: ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'],
  zhien_zaran: ['zhien_zaran', 'kuda_zhekzhen'],
  kuda_zhekzhen: ['kuda_zhekzhen']
};

function formatGift(gift) {
  return {
    id: gift.id,
    coupleId: gift.coupleId,
    name: gift.name,
    description: gift.description,
    targetAmount: gift.targetAmount,
    fundedAmount: gift.fundedAmount,
    remainingAmount: gift.targetAmount - gift.fundedAmount,
    progressPercent: (gift.fundedAmount / gift.targetAmount) * 100,
    currency: gift.currency,
    status: gift.status,
    allowedTiers: gift.allowedTiers,
    imageUrls: gift.imageUrls,
    handlingFlags: gift.handlingFlags || [],
    handlingFlagsInfo: annotateFlags(gift.handlingFlags || []),
    deliveryNote: buildDeliveryNote(gift.handlingFlags || []),
    packagingRequirements: getPackagingRequirements(gift.handlingFlags || []),
    createdAt: gift.createdAt
  };
}

function giftVisibleForTier(gift, tier) {
  if (!Array.isArray(gift.allowedTiers)) return false;
  // Иерархическая проверка: если подарок доступен для любого из тиров,
  // которые входят в видимость данного гостя, то показываем
  const allowedCategories = TIER_VISIBILITY[tier] || [tier];
  return gift.allowedTiers.some(t => allowedCategories.includes(t));
}

function toPositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

async function createGift(req, res) {
  const { name, description, targetAmount, currency, allowedTiers, imageUrls, handlingFlags } = req.body;
  const coupleId = req.user.id;

  if (req.user.role !== 'couple') {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Only couples can add gifts',
      timestamp: new Date().toISOString()
    });
  }

  const profile = await prisma.coupleProfile.findUnique({
    where: { coupleId }
  });

  if (!profile) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Wedding profile not found. Please create wedding profile first.',
      timestamp: new Date().toISOString()
    });
  }

  const giftCurrency = currency || 'KZT';
  if (!VALID_CURRENCIES.includes(giftCurrency)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: `Invalid currency. Supported currencies: ${VALID_CURRENCIES.join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }

  if (!name || !targetAmount || targetAmount < 1000) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: `Name is required and target amount must be at least ${formatAmount(1000, giftCurrency)}`,
      timestamp: new Date().toISOString()
    });
  }

  // ── Валидация флагов транспортировки ────────────────────────────────
  const giftHandlingFlags = handlingFlags || [];
  if (giftHandlingFlags.length > 0) {
    const flagValidation = validateHandlingFlags(giftHandlingFlags);
    if (!flagValidation.valid) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `Invalid handling flags: ${flagValidation.invalidFlags.join(', ')}. Valid flags: ${ALL_VALID_FLAGS.join(', ')}`,
        invalidFlags: flagValidation.invalidFlags,
        validFlags: ALL_VALID_FLAGS,
        timestamp: new Date().toISOString()
      });
    }
  }

  try {
    const gift = await prisma.gift.create({
      data: {
        coupleId,
        name,
        description,
        targetAmount,
        fundedAmount: 0,
        currency: giftCurrency,
        status: 'pending',
        allowedTiers: allowedTiers || ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'],
        imageUrls: imageUrls || [],
        handlingFlags: giftHandlingFlags,
      }
    });

    res.status(201).json({
      message: 'Gift added successfully',
      gift: {
        id: gift.id,
        name: gift.name,
        description: gift.description,
        targetAmount: gift.targetAmount,
        fundedAmount: gift.fundedAmount,
        currency: gift.currency,
        status: gift.status,
        allowedTiers: gift.allowedTiers,
        handlingFlags: gift.handlingFlags,
        handlingFlagsInfo: annotateFlags(gift.handlingFlags || []),
        deliveryNote: buildDeliveryNote(gift.handlingFlags || []),
        packagingRequirements: getPackagingRequirements(gift.handlingFlags || []),
        createdAt: gift.createdAt
      }
    });
  } catch (error) {
    console.error('Create gift error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function getGifts(req, res) {
  const coupleId = req.user.id;
  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, 10);
  const skip = (page - 1) * limit;

  try {
    const [gifts, total] = await Promise.all([
      prisma.gift.findMany({
        where: { coupleId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.gift.count({
        where: { coupleId }
      })
    ]);

        res.json({
      gifts: gifts.map((gift) => ({
        id: gift.id,
        name: gift.name,
        description: gift.description,
        targetAmount: gift.targetAmount,
        fundedAmount: gift.fundedAmount,
        remainingAmount: gift.targetAmount - gift.fundedAmount,
        progressPercent: (gift.fundedAmount / gift.targetAmount) * 100,
        currency: gift.currency,
        status: gift.status,
        allowedTiers: gift.allowedTiers,
        handlingFlags: gift.handlingFlags,
        handlingFlagsInfo: annotateFlags(gift.handlingFlags || []),
        deliveryNote: buildDeliveryNote(gift.handlingFlags || []),
        packagingRequirements: getPackagingRequirements(gift.handlingFlags || []),
        createdAt: gift.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    console.error('Get gifts error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get gifts',
      timestamp: new Date().toISOString()
    });
  }
}

async function getGiftsForCouple(req, res) {
  const coupleId = parseInt(req.params.coupleId, 10);
  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, 10);
  const skip = (page - 1) * limit;

  if (Number.isNaN(coupleId)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid couple id',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const wedding = await prisma.coupleProfile.findUnique({
      where: { coupleId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        }
      }
    });

    if (!wedding) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Wedding profile not found',
        timestamp: new Date().toISOString()
      });
    }

    const isOwner = req.user.role === 'couple' && req.user.id === coupleId;
    let kinshipTier = null;

    if (!isOwner) {
      const familyEntry = await prisma.familyTree.findFirst({
        where: {
          coupleId,
          guestId: req.user.id
        }
      });

      if (!familyEntry) {
        return res.json({
          wedding,
          kinshipTier: null,
          gifts: [],
          pagination: { page, limit, total: 0, pages: 0 },
          message: 'Пара еще не добавила вас в список родственников. Попросите пару добавить ваш телефон и выбрать родство.'
        });
      }

      kinshipTier = familyEntry.kinshipTier;
    }

        const allGifts = await prisma.gift.findMany({
      where: {
        coupleId,
        status: { not: 'delivered' }
      },
      orderBy: { createdAt: 'desc' }
    });

    const visibleGifts = isOwner
      ? allGifts
      : allGifts.filter((gift) => giftVisibleForTier(gift, kinshipTier));

    const pagedGifts = visibleGifts.slice(skip, skip + limit);

    return res.json({
      wedding,
      kinshipTier,
      gifts: pagedGifts.map(formatGift),
      pagination: {
        page,
        limit,
        total: visibleGifts.length,
        pages: Math.max(1, Math.ceil(visibleGifts.length / limit))
      }
    });
  } catch (error) {
    console.error('Get gifts for couple error:', error);
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get wedding gifts',
      timestamp: new Date().toISOString()
    });
  }
}

async function getGiftById(req, res) {
  const { giftId } = req.params;

  try {
    const gift = await prisma.gift.findUnique({
      where: { id: parseInt(giftId, 10) }
    });

    if (!gift) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Gift not found',
        timestamp: new Date().toISOString()
      });
    }

    const isOwner = req.user.role === 'couple' && req.user.id === gift.coupleId;

    if (!isOwner) {
      const familyEntry = await prisma.familyTree.findFirst({
        where: {
          coupleId: gift.coupleId,
          guestId: req.user.id
        }
      });

      if (!familyEntry || !giftVisibleForTier(gift, familyEntry.kinshipTier)) {
        return res.status(403).json({
          code: 'FORBIDDEN',
          message: 'This gift is not available for your kinship tier',
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      gift: formatGift(gift)
    });
  } catch (error) {
    console.error('Get gift error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get gift',
      timestamp: new Date().toISOString()
    });
  }
}

async function deleteGift(req, res) {
  const { giftId } = req.params;
  const coupleId = req.user.id;

  try {
    const gift = await prisma.gift.findFirst({
      where: {
        id: parseInt(giftId, 10),
        coupleId
      }
    });

    if (!gift) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Gift not found or does not belong to you',
        timestamp: new Date().toISOString()
      });
    }

    if (gift.fundedAmount > 0) {
      return res.status(409).json({
        code: 'CONFLICT',
        message: 'Cannot delete gift with existing contributions',
        timestamp: new Date().toISOString()
      });
    }

    // Actual delete (not soft-delete) for gifts with no contributions
    await prisma.gift.delete({
      where: { id: parseInt(giftId, 10) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete gift error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete gift',
      timestamp: new Date().toISOString()
    });
  }
}

async function updateGift(req, res) {
  const { giftId } = req.params;
  const { name, description, targetAmount, currency, allowedTiers, imageUrls, handlingFlags } = req.body;
  const coupleId = req.user.id;

  if (req.user.role !== 'couple') {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Only couples can update gifts',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const gift = await prisma.gift.findFirst({
      where: {
        id: parseInt(giftId, 10),
        coupleId
      }
    });

    if (!gift) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Gift not found or does not belong to you',
        timestamp: new Date().toISOString()
      });
    }

    if (gift.fundedAmount > 0 && (targetAmount && targetAmount !== gift.targetAmount)) {
      return res.status(409).json({
        code: 'CONFLICT',
        message: 'Cannot change gift price after contributions have been made',
        timestamp: new Date().toISOString()
      });
    }

    if (currency !== undefined && !VALID_CURRENCIES.includes(currency)) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `Invalid currency. Supported: ${VALID_CURRENCIES.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    if (gift.fundedAmount > 0 && currency !== undefined && currency !== gift.currency) {
      return res.status(409).json({
        code: 'CONFLICT',
        message: 'Cannot change gift currency after contributions have been made',
        timestamp: new Date().toISOString()
      });
    }

    // ── Валидация флагов транспортировки при обновлении ───────────────
    if (handlingFlags !== undefined) {
      if (!Array.isArray(handlingFlags)) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'handlingFlags must be an array',
          timestamp: new Date().toISOString()
        });
      }
      const flagValidation = validateHandlingFlags(handlingFlags);
      if (!flagValidation.valid) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: `Invalid handling flags: ${flagValidation.invalidFlags.join(', ')}. Valid flags: ${ALL_VALID_FLAGS.join(', ')}`,
          invalidFlags: flagValidation.invalidFlags,
          validFlags: ALL_VALID_FLAGS,
          timestamp: new Date().toISOString()
        });
      }
    }

    const updatedGift = await prisma.gift.update({
      where: { id: parseInt(giftId, 10) },
      data: {
        name: name !== undefined ? name : gift.name,
        description: description !== undefined ? description : gift.description,
        targetAmount: targetAmount !== undefined ? targetAmount : gift.targetAmount,
        currency: currency !== undefined ? currency : gift.currency,
        allowedTiers: allowedTiers !== undefined ? allowedTiers : gift.allowedTiers,
        imageUrls: imageUrls !== undefined ? imageUrls : gift.imageUrls,
        handlingFlags: handlingFlags !== undefined ? handlingFlags : gift.handlingFlags,
      }
    });

    res.json({
      message: 'Gift updated successfully',
      gift: {
        id: updatedGift.id,
        name: updatedGift.name,
        description: updatedGift.description,
        targetAmount: updatedGift.targetAmount,
        fundedAmount: updatedGift.fundedAmount,
        currency: updatedGift.currency,
        status: updatedGift.status,
        allowedTiers: updatedGift.allowedTiers,
        imageUrls: updatedGift.imageUrls,
        handlingFlags: updatedGift.handlingFlags,
        handlingFlagsInfo: annotateFlags(updatedGift.handlingFlags || []),
        deliveryNote: buildDeliveryNote(updatedGift.handlingFlags || []),
        packagingRequirements: getPackagingRequirements(updatedGift.handlingFlags || []),
        createdAt: updatedGift.createdAt,
        updatedAt: updatedGift.updatedAt
      }
    });
  } catch (error) {
    console.error('Update gift error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update gift',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  createGift,
  getGifts,
  getGiftsForCouple,
  getGiftById,
  deleteGift,
  updateGift
};
