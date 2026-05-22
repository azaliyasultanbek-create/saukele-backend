const { prisma } = require('../config/database');
const { isCurrencySupported, convert, formatAmount, snapshotRate } = require('../services/currencyService');
const { emailQueue } = require('../queues/emailQueue');
const { guardImmutableFields, assertContributionIsLocked } = require('../services/immutableFieldsService');
const { annotateFlags, buildDeliveryNote, getPackagingRequirements } = require('../services/handlingFlagsService');

const VALID_CURRENCIES = ['KZT', 'EUR', 'USD'];

async function canAccessGift(user, gift, tx = prisma) {
  if (user.role === 'couple' && user.id === gift.coupleId) return true;

  const familyEntry = await tx.familyTree.findFirst({
    where: {
      coupleId: gift.coupleId,
      guestId: user.id
    }
  });

    if (!familyEntry || !Array.isArray(gift.allowedTiers)) return false;
 
  const TIER_VISIBILITY = {
    ata_ana: ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'],
    zhien_zaran: ['zhien_zaran', 'kuda_zhekzhen'],
    kuda_zhekzhen: ['kuda_zhekzhen']
  };
  const allowedCategories = TIER_VISIBILITY[familyEntry.kinshipTier] || [familyEntry.kinshipTier];
  return gift.allowedTiers.some(t => allowedCategories.includes(t));
}

async function createContribution(req, res) {
  const { giftId, amount, currency, isAnonymous } = req.body;
  const guestId = req.user.id;
  const paymentCurrency = currency || 'KZT';
  if (!VALID_CURRENCIES.includes(paymentCurrency)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: `Invalid currency. Supported: ${VALID_CURRENCIES.join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }
  
  if (!giftId || !amount || amount < 1) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'giftId and amount are required',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      const gift = await tx.gift.findUnique({
        where: { id: giftId }
      });
      
      if (!gift) {
        throw new Error('GIFT_NOT_FOUND');
      }
      
      if (gift.status === 'funded' || gift.status === 'paid_out') {
        throw new Error('GIFT_ALREADY_FUNDED');
      }

      const hasAccess = await canAccessGift(req.user, gift, tx);
      if (!hasAccess) {
        throw new Error('GIFT_FORBIDDEN');
      }
      
            
            const rateSnapshot = snapshotRate(
  paymentCurrency,
  gift.currency,
  amount
);

const amountInGiftCurrency =
  rateSnapshot.convertedAmount;



      const exchangeRate = rateSnapshot.rate;
      const lockedTimestamp = new Date(rateSnapshot.rateTimestamp);
      
            const remaining = gift.targetAmount - gift.fundedAmount;
            if (amountInGiftCurrency > remaining) {
              throw new Error(`MAX_CONTRIBUTION_EXCEEDED:${remaining}:${paymentCurrency}`);
            }

      const contribution = await tx.contribution.create({
        data: {
          giftId,
          guestId,
          amount: amountInGiftCurrency,
          exchangeRateUsed: exchangeRate,
          currencyUsed: paymentCurrency,
          originalAmount: amount,
          status: 'completed',
          isAnonymous: isAnonymous || false,
          
          lockedAt: lockedTimestamp,
          lockedRate: exchangeRate,
        }
      });
      
      
      const newFundedAmount = gift.fundedAmount + amountInGiftCurrency;
      const newStatus = newFundedAmount >= gift.targetAmount ? 'funded' : 'funding';
      
      const updatedGift = await tx.gift.update({
        where: { id: giftId },
        data: {
          fundedAmount: newFundedAmount,
          status: newStatus
        }
      });
      
      return { contribution, gift: updatedGift };
    });


    if (req.user.email) {
      await emailQueue.add('contribution-confirmation', {
        type: 'contribution-confirmation',
        to: req.user.email,
        data: {
          giftName: result.gift.name,
          amount: result.contribution.originalAmount,
          currency: result.contribution.currencyUsed
        }
      });
    }


    if (result.gift.status === 'funded') {
      const couple = await prisma.coupleProfile.findUnique({
        where: { coupleId: result.gift.coupleId },
        include: { user: true }
      });

      if (couple?.user?.email) {
        await emailQueue.add('gift-funded', {
          type: 'gift-funded',
          to: couple.user.email,
          data: {
            giftName: result.gift.name,
            targetAmount: result.gift.targetAmount,
            currency: result.gift.currency
          }
        });
      }
    }

        res.status(201).json({
      message: 'Contribution successful',
      contribution: {
        id: result.contribution.id,
        giftId: result.contribution.giftId,
        amount: result.contribution.amount,
        currency: result.gift.currency,
        paidAmount: result.contribution.originalAmount,
        paidCurrency: result.contribution.currencyUsed,
        exchangeRate: result.contribution.exchangeRateUsed,
        isAnonymous: result.contribution.isAnonymous,
        timestamp: result.contribution.timestamp,
       
        lockedAt: result.contribution.lockedAt,
        lockedRate: result.contribution.lockedRate,
        rateTimestamp: result.contribution.lockedAt,
      },
            gift: {
        id: result.gift.id,
        fundedAmount: result.gift.fundedAmount,
        targetAmount: result.gift.targetAmount,
        currency: result.gift.currency,
        remainingAmount: result.gift.targetAmount - result.gift.fundedAmount,
        progressPercent: (result.gift.fundedAmount / result.gift.targetAmount) * 100,
        status: result.gift.status,
        
        handlingFlags: result.gift.handlingFlags || [],
        handlingFlagsInfo: annotateFlags(result.gift.handlingFlags || []),
        deliveryNote: buildDeliveryNote(result.gift.handlingFlags || []),
        packagingRequirements: getPackagingRequirements(result.gift.handlingFlags || []),
      }
    });
    
  } catch (error) {
    console.error('Contribution error:', error);
    
    if (error.message === 'GIFT_NOT_FOUND') {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Gift not found',
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.message === 'GIFT_ALREADY_FUNDED') {
      return res.status(409).json({
        code: 'CONFLICT',
        message: 'This gift is already fully funded',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message === 'GIFT_FORBIDDEN') {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'This gift is not available for your kinship tier',
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.message.startsWith('MAX_CONTRIBUTION_EXCEEDED:')) {
      const parts = error.message.split(':');
      const maxAllowed = parts[1];
      const curr = parts[2] || 'KZT';
      return res.status(400).json({
        code: 'MAX_CONTRIBUTION_EXCEEDED',
        message: `You cannot contribute more than the remaining amount (max ${formatAmount(parseInt(maxAllowed), curr)})`,
        maxAllowed: parseInt(maxAllowed),
        currency: curr,
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.message.startsWith('MIN_AMOUNT:')) {
      const minStr = error.message.split(':')[1];
      return res.status(400).json({
        code: 'MIN_AMOUNT',
        message: `Minimum contribution amount is ${minStr}`,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function getContributionsByGift(req, res) {
  const { giftId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const gift = await prisma.gift.findUnique({
      where: { id: parseInt(giftId) }
    });

    if (!gift) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Gift not found',
        timestamp: new Date().toISOString()
      });
    }

    const hasAccess = await canAccessGift(req.user, gift);
    if (!hasAccess) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'This gift is not available for your kinship tier',
        timestamp: new Date().toISOString()
      });
    }

    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where: { giftId: parseInt(giftId) },
        include: {
          guest: {
            select: {
              id: true,
              fullName: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.contribution.count({
        where: { giftId: parseInt(giftId) }
      })
    ]);

    const totalAmount = gift.fundedAmount;

        res.json({
      giftId: parseInt(giftId),
      giftCurrency: gift.currency,
      totalAmount,
      totalAmountFormatted: formatAmount(totalAmount, gift.currency),
      totalContributors: total,
   
      handlingFlags: gift.handlingFlags || [],
      handlingFlagsInfo: annotateFlags(gift.handlingFlags || []),
      deliveryNote: buildDeliveryNote(gift.handlingFlags || []),
      packagingRequirements: getPackagingRequirements(gift.handlingFlags || []),
      contributions: contributions.map(c => ({
        id: c.id,
        amount: c.amount,
        currency: gift.currency,
        originalAmount: c.originalAmount,
        originalCurrency: c.currencyUsed,
        exchangeRate: c.exchangeRateUsed,
        guestName: c.isAnonymous ? 'Anonymous' : c.guest.fullName,
        isAnonymous: c.isAnonymous,
        timestamp: c.timestamp,
        
        lockedAt: c.lockedAt,
        lockedRate: c.lockedRate,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    console.error('Get contributions error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get contributions',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  createContribution,
  getContributionsByGift
};
