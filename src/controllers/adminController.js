const { prisma } = require('../config/database');

async function adminGetAllWeddings(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const status = req.query.status; // 'active', 'inactive', 'all'
  const search = req.query.search; // поиск по имени

  let where = {};
  
  if (status === 'active') where.isActive = true;
  else if (status === 'inactive') where.isActive = false;
  
  if (search) {
    where.OR = [
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { partner2Name: { contains: search, mode: 'insensitive' } }
    ];
  }

  try {
    const [weddings, total] = await Promise.all([
      prisma.coupleProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              fullName: true,
              email: true,
              isVerified: true,
              emailVerified: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              gifts: true,
              familyTree: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.coupleProfile.count({ where })
    ]);

    res.json({
      weddings: weddings.map(w => ({
        coupleId: w.coupleId,
        couple: w.user,
        partner2Name: w.partner2Name,
        weddingDate: w.weddingDate,
        venue: w.venue,
        story: w.story,
        coverPhotoUrl: w.coverPhotoUrl,
        isActive: w.isActive,
        giftsCount: w._count.gifts,
        familyMembersCount: w._count.familyTree,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    console.error('Admin get all weddings error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get weddings',
      timestamp: new Date().toISOString()
    });
  }
}
async function adminGetWeddingDetails(req, res) {
  const { coupleId } = req.params;

  try {
    const wedding = await prisma.coupleProfile.findUnique({
      where: { coupleId: parseInt(coupleId) },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            fullName: true,
            email: true,
            isVerified: true,
            emailVerified: true,
            createdAt: true
          }
        },
        gifts: {
          include: {
            _count: { select: { contributions: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        familyTree: {
          include: {
            guest: {
              select: {
                id: true,
                fullName: true,
                phone: true
              }
            }
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

    res.json({
      wedding: {
        coupleId: wedding.coupleId,
        couple: wedding.user,
        partner2Name: wedding.partner2Name,
        weddingDate: wedding.weddingDate,
        venue: wedding.venue,
        story: wedding.story,
        coverPhotoUrl: wedding.coverPhotoUrl,
        isActive: wedding.isActive,
        gifts: wedding.gifts.map(g => ({
          id: g.id,
          name: g.name,
          targetAmount: g.targetAmount,
          fundedAmount: g.fundedAmount,
          currency: g.currency,
          status: g.status,
          contributionsCount: g._count.contributions,
          createdAt: g.createdAt
        })),
        familyMembers: wedding.familyTree.map(f => ({
          id: f.id,
          guest: f.guest,
          kinshipTier: f.kinshipTier
        })),
        createdAt: wedding.createdAt,
        updatedAt: wedding.updatedAt
      }
    });
  } catch (error) {
    console.error('Admin get wedding details error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get wedding details',
      timestamp: new Date().toISOString()
    });
  }
}

async function adminUpdateWedding(req, res) {
  const { coupleId } = req.params;
  const { partner2Name, weddingDate, venue, story, coverPhotoUrl, isActive } = req.body;

  try {
    const existing = await prisma.coupleProfile.findUnique({
      where: { coupleId: parseInt(coupleId) }
    });

    if (!existing) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Wedding profile not found',
        timestamp: new Date().toISOString()
      });
    }

    const updated = await prisma.coupleProfile.update({
      where: { coupleId: parseInt(coupleId) },
      data: {
        partner2Name: partner2Name !== undefined ? partner2Name : existing.partner2Name,
        weddingDate: weddingDate !== undefined ? new Date(weddingDate) : existing.weddingDate,
        venue: venue !== undefined ? venue : existing.venue,
        story: story !== undefined ? story : existing.story,
        coverPhotoUrl: coverPhotoUrl !== undefined ? coverPhotoUrl : existing.coverPhotoUrl,
        isActive: isActive !== undefined ? isActive : existing.isActive
      }
    });

    res.json({
      message: 'Wedding updated successfully',
      wedding: {
        coupleId: updated.coupleId,
        partner2Name: updated.partner2Name,
        weddingDate: updated.weddingDate,
        venue: updated.venue,
        story: updated.story,
        coverPhotoUrl: updated.coverPhotoUrl,
        isActive: updated.isActive
      }
    });
  } catch (error) {
    console.error('Admin update wedding error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update wedding',
      timestamp: new Date().toISOString()
    });
  }
}

async function adminDeleteWedding(req, res) {
  const { coupleId } = req.params;

  try {
    const existing = await prisma.coupleProfile.findUnique({
      where: { coupleId: parseInt(coupleId) }
    });

    if (!existing) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Wedding profile not found',
        timestamp: new Date().toISOString()
      });
    }

    await prisma.coupleProfile.update({
      where: { coupleId: parseInt(coupleId) },
      data: { isActive: false }
    });

    res.json({
      message: 'Wedding deactivated successfully',
      coupleId: parseInt(coupleId)
    });
  } catch (error) {
    console.error('Admin delete wedding error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete wedding',
      timestamp: new Date().toISOString()
    });
  }
}

async function adminGetUsers(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const role = req.query.role; // 'couple', 'guest', 'admin'
  const search = req.query.search;

  let where = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          email: true,
          fullName: true,
          role: true,
          isVerified: true,
          emailVerified: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get users',
      timestamp: new Date().toISOString()
    });
  }
}
async function adminUpdateUser(req, res) {
  const { userId } = req.params;
  const { role, isVerified, emailVerified } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!user) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    if (user.role === 'admin' && role && role !== 'admin') {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Cannot change role of another admin',
        timestamp: new Date().toISOString()
      });
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        role: role !== undefined ? role : user.role,
        isVerified: isVerified !== undefined ? isVerified : user.isVerified,
        emailVerified: emailVerified !== undefined ? emailVerified : user.emailVerified,
        emailVerifiedAt: emailVerified ? new Date() : user.emailVerifiedAt
      },
      select: {
        id: true,
        phone: true,
        email: true,
        fullName: true,
        role: true,
        isVerified: true,
        emailVerified: true
      }
    });

    res.json({
      message: 'User updated successfully',
      user: updated
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update user',
      timestamp: new Date().toISOString()
    });
  }
}
async function adminGetStats(req, res) {
  try {
    const [
      totalUsers,
      totalCouples,
      totalGuests,
      totalWeddings,
      totalActiveWeddings,
      totalGifts,
      totalContributions,
      totalFundedAmount,
      recentUsers,
      recentContributions
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'couple' } }),
      prisma.user.count({ where: { role: 'guest' } }),
      prisma.coupleProfile.count(),
      prisma.coupleProfile.count({ where: { isActive: true } }),
      prisma.gift.count(),
      prisma.contribution.count(),
      prisma.contribution.aggregate({ _sum: { amount: true } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          fullName: true,
          phone: true,
          role: true,
          createdAt: true
        }
      }),
      prisma.contribution.findMany({
        orderBy: { timestamp: 'desc' },
        take: 5,
        include: {
          guest: { select: { fullName: true } },
          gift: { select: { name: true } }
        }
      })
    ]);

    res.json({
      stats: {
        users: {
          total: totalUsers,
          couples: totalCouples,
          guests: totalGuests
        },
        weddings: {
          total: totalWeddings,
          active: totalActiveWeddings
        },
        gifts: {
          total: totalGifts
        },
        contributions: {
          total: totalContributions,
          totalAmount: totalFundedAmount._sum.amount || 0
        }
      },
      recentUsers,
      recentContributions: recentContributions.map(c => ({
        id: c.id,
        guestName: c.guest.fullName,
        giftName: c.gift.name,
        amount: c.amount,
        timestamp: c.timestamp
      }))
    });
  } catch (error) {
    console.error('Admin get stats error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get stats',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  adminGetAllWeddings,
  adminGetWeddingDetails,
  adminUpdateWedding,
  adminDeleteWedding,
  adminGetUsers,
  adminUpdateUser,
  adminGetStats
};
