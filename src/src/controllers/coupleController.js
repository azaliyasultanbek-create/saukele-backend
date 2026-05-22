const { prisma } = require('../config/database');

async function createWeddingProfile(req, res) {
  console.log(' createWeddingProfile called');
  console.log('   User:', req.user);
  console.log('   Body:', req.body);
  
  const { partner2Name, weddingDate, venue, story, coverPhotoUrl } = req.body;
  const userId = req.user.id;
  
  if (req.user.role !== 'couple') {
    console.log(' Role check failed:', req.user.role);
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Only couples can create wedding profiles',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const existingProfile = await prisma.coupleProfile.findUnique({
      where: { coupleId: userId }
    });
    
    console.log('   Existing profile:', existingProfile);
    
    if (existingProfile) {
      return res.status(409).json({
        code: 'PROFILE_EXISTS',
        message: 'Wedding profile already exists for this user',
        timestamp: new Date().toISOString()
      });
    }
    
    const profile = await prisma.coupleProfile.create({
      data: {
        coupleId: userId,
        partner2Name,
        weddingDate: new Date(weddingDate),
        venue,
        story,
        coverPhotoUrl
      }
    });
    
    console.log(' Profile created:', profile);
    
    res.status(201).json({
      message: 'Wedding profile created successfully',
      profile: {
        coupleId: profile.coupleId,
        partner2Name: profile.partner2Name,
        weddingDate: profile.weddingDate,
        venue: profile.venue,
        story: profile.story,
        coverPhotoUrl: profile.coverPhotoUrl
      }
    });
  } catch (error) {
    console.error(' Detailed error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function getWeddingProfile(req, res) {
  const { coupleId } = req.params;
  
  try {
    const profile = await prisma.coupleProfile.findUnique({
      where: { coupleId: parseInt(coupleId) },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            fullName: true
          }
        }
      }
    });
    
    if (!profile) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Wedding profile not found',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ profile });
  } catch (error) {
    console.error('Get wedding profile error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get wedding profile',
      timestamp: new Date().toISOString()
    });
  }
}

async function getAllWeddings(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const [weddings, total] = await Promise.all([
      prisma.coupleProfile.findMany({
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              fullName: true
            }
          }
        },
        orderBy: { weddingDate: 'asc' },
        skip,
        take: limit
      }),
      prisma.coupleProfile.count({
        where: { isActive: true }
      })
    ]);

    res.json({
      weddings: weddings.map(wedding => ({
        coupleId: wedding.coupleId,
        coupleName: wedding.user.fullName,
        partner2Name: wedding.partner2Name,
        weddingDate: wedding.weddingDate,
        venue: wedding.venue,
        story: wedding.story,
        coverPhotoUrl: wedding.coverPhotoUrl
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    console.error('Get all weddings error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get weddings',
      timestamp: new Date().toISOString()
    });
  }
}

async function updateWeddingProfile(req, res) {
  const { coupleId } = req.params;
  const { partner2Name, weddingDate, venue, story, coverPhotoUrl, isActive } = req.body;
  const userId = req.user.id;
  
  if (req.user.role !== 'couple') {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Only couples can update wedding profiles',
      timestamp: new Date().toISOString()
    });
  }
  
  if (parseInt(coupleId) !== userId) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'You can only update your own wedding profile',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const existingProfile = await prisma.coupleProfile.findUnique({
      where: { coupleId: parseInt(coupleId) }
    });
    
    if (!existingProfile) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Wedding profile not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const updatedProfile = await prisma.coupleProfile.update({
      where: { coupleId: parseInt(coupleId) },
      data: {
        partner2Name: partner2Name !== undefined ? partner2Name : existingProfile.partner2Name,
        weddingDate: weddingDate !== undefined ? new Date(weddingDate) : existingProfile.weddingDate,
        venue: venue !== undefined ? venue : existingProfile.venue,
        story: story !== undefined ? story : existingProfile.story,
        coverPhotoUrl: coverPhotoUrl !== undefined ? coverPhotoUrl : existingProfile.coverPhotoUrl,
        isActive: isActive !== undefined ? isActive : existingProfile.isActive
      }
    });
    
    res.json({
      message: 'Wedding profile updated successfully',
      profile: {
        coupleId: updatedProfile.coupleId,
        partner2Name: updatedProfile.partner2Name,
        weddingDate: updatedProfile.weddingDate,
        venue: updatedProfile.venue,
        story: updatedProfile.story,
        coverPhotoUrl: updatedProfile.coverPhotoUrl,
        isActive: updatedProfile.isActive
      }
    });
  } catch (error) {
    console.error('Update wedding profile error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update wedding profile',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  createWeddingProfile,
  getWeddingProfile,
  getAllWeddings,
  updateWeddingProfile  
};