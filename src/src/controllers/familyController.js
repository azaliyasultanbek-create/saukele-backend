const { prisma } = require('../config/database');

const VALID_TIERS = ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'];
const TIER_CATEGORY_MAP = {
  ata_ana: 'ATA_ANA',
  zhien_zaran: 'ZHIEN_ZhARAN',
  kuda_zhekzhen: 'KUDA_ZHEKZhEN'
};
const TIER_VISIBILITY = {
  ata_ana: ['ATA_ANA', 'ZHIEN_ZhARAN', 'KUDA_ZHEKZhEN'],
  zhien_zaran: ['ZHIEN_ZhARAN', 'KUDA_ZHEKZhEN'],
  kuda_zhekzhen: ['KUDA_ZHEKZhEN']
};

async function addFamilyMember(req, res) {
  const { guestPhone, kinshipTier, parentId } = req.body;
  const coupleId = req.user.id;
  
  if (req.user.role !== 'couple' && req.user.role !== 'admin') {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Только пара может добавлять родственников',
      timestamp: new Date().toISOString()
    });
  }

  if (!guestPhone || !VALID_TIERS.includes(kinshipTier)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: `guestPhone и valid kinshipTier обязательны (${VALID_TIERS.join(', ')})`,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const guest = await prisma.user.findUnique({
      where: { phone: guestPhone }
    });
    
    if (!guest) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Гость не найден. Пользователь должен сначала зарегистрироваться.',
        timestamp: new Date().toISOString()
      });
    }
    if (guest.id === coupleId) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Нельзя добавить себя как родственника',
        timestamp: new Date().toISOString()
      });
    }

    if (parentId) {
      const parentEntry = await prisma.familyTree.findFirst({
        where: { id: parentId, coupleId }
      });
      if (!parentEntry) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Указанный родительский узел не найден в родословной этой пары',
          timestamp: new Date().toISOString()
        });
      }
    }

    const category = TIER_CATEGORY_MAP[kinshipTier];

    const familyMember = await prisma.familyTree.upsert({
      where: {
        coupleId_guestId: {
          coupleId,
          guestId: guest.id
        }
      },
      update: { kinshipTier, category, parentId: parentId || undefined },
      create: {
        coupleId,
        guestId: guest.id,
        kinshipTier,
        category,
        parentId
      }
    });
    
    const fullGuest = await prisma.user.findUnique({
      where: { id: guest.id },
      select: { fullName: true }
    });
    
    res.status(201).json({
      message: 'Родственник успешно добавлен',
      member: {
        id: familyMember.id,
        guestId: familyMember.guestId,
        guestName: fullGuest.fullName,
        kinshipTier: familyMember.kinshipTier,
        category: familyMember.category,
        parentId: familyMember.parentId
      }
    });
  } catch (error) {
    console.error('Add family member error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function getMyKinship(req, res) {
  const guestId = req.user.id;
  
  try {
    const familyEntry = await prisma.familyTree.findFirst({
      where: { guestId },
      include: {
        couple: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (!familyEntry) {
      return res.json({
        kinshipTier: null,
        category: null,
        message: 'Вы ещё не добавлены в родословную'
      });
    }
    
    res.json({
      kinshipTier: familyEntry.kinshipTier,
      category: familyEntry.category,
      coupleName: familyEntry.couple.user.fullName,
      coupleId: familyEntry.coupleId
    });
  } catch (error) {
    console.error('Get kinship error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Не удалось получить информацию о родстве',
      timestamp: new Date().toISOString()
    });
  }
}

async function getFamilyTree(req, res) {
  const coupleId = parseInt(req.params.coupleId, 10);
  
  if (Number.isNaN(coupleId)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Некорректный ID пары',
      timestamp: new Date().toISOString()
    });
  }

  try {
    
    const wedding = await prisma.coupleProfile.findUnique({
      where: { coupleId },
      include: {
        user: {
          select: { id: true, fullName: true }
        }
      }
    });

    if (!wedding) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Свадьба не найдена',
        timestamp: new Date().toISOString()
      });
    }

    const familyEntries = await prisma.familyTree.findMany({
      where: { coupleId },
      include: {
        guest: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

  
    const nodeMap = new Map();
    const roots = [];

   
    for (const entry of familyEntries) {
      const node = {
        id: entry.id,
        guestId: entry.guestId,
        guestName: entry.guest.fullName,
        guestPhone: entry.guest.phone,
        kinshipTier: entry.kinshipTier,
        category: entry.category,
        parentId: entry.parentId,
        depth: 0, // будет вычислено ниже
        children: [],
      };
      nodeMap.set(entry.id, node);
    }

   
    const computeDepth = (node, depth) => {
      node.depth = depth;
      for (const child of node.children) {
        computeDepth(child, depth + 1);
      }
    };

    for (const entry of familyEntries) {
      const node = nodeMap.get(entry.id);
      if (entry.parentId && nodeMap.has(entry.parentId)) {
        nodeMap.get(entry.parentId).children.push(node);
      } else {
        
        roots.push(node);
      }
    }

    for (const root of roots) {
      computeDepth(root, 0);
    }

    const groupedByCategory = {
      ATA_ANA: {
        category: 'ATA_ANA',
        label: 'Ата-ана (родители и старшие)',
        members: []
      },
      ZHIEN_ZhARAN: {
        category: 'ZHIEN_ZhARAN',
        label: 'Жиен-жаран (родственники по линии матери)',
        members: []
      },
      KUDA_ZHEKZhEN: {
        category: 'KUDA_ZHEKZhEN',
        label: 'Құда-жекжең (сваты/кумовья)',
        members: []
      }
    };

    for (const entry of familyEntries) {
      const cat = entry.category;
      if (groupedByCategory[cat]) {
        const node = nodeMap.get(entry.id);
        groupedByCategory[cat].members.push({
          id: entry.id,
          guestId: entry.guestId,
          guestName: entry.guest.fullName,
          guestPhone: entry.guest.phone,
          kinshipTier: entry.kinshipTier,
          parentId: entry.parentId,
          depth: node ? node.depth : 0,
        });
      }
    }

    const registries = await prisma.kinshipRegistry.findMany({
      where: { coupleId },
      orderBy: { sortOrder: 'asc' }
    });

    res.json({
      couple: {
        id: wedding.coupleId,
        name: wedding.user.fullName,
        partner2Name: wedding.partner2Name
      },
      tree: roots,
      groupedByCategory: Object.values(groupedByCategory),
      registries,
      meta: {
        totalMembers: familyEntries.length,
        categories: {
          ATA_ANA: groupedByCategory.ATA_ANA.members.length,
          ZHIEN_ZhARAN: groupedByCategory.ZHIEN_ZhARAN.members.length,
          KUDA_ZHEKZhEN: groupedByCategory.KUDA_ZHEKZhEN.members.length
        }
      }
    });
  } catch (error) {
    console.error('Get family tree error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Не удалось получить генеалогическое древо',
      timestamp: new Date().toISOString()
    });
  }
}

async function createRegistryEntry(req, res) {
  const { name, description, category, parentId } = req.body;
  const coupleId = req.user.id;

  if (!name || !category) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'name и category обязательны',
      timestamp: new Date().toISOString()
    });
  }

  const validCategories = ['ATA_ANA', 'ZHIEN_ZhARAN', 'KUDA_ZHEKZhEN'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: `category должна быть одной из: ${validCategories.join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const maxSort = await prisma.kinshipRegistry.aggregate({
      where: { coupleId },
      _max: { sortOrder: true }
    });

    const entry = await prisma.kinshipRegistry.create({
      data: {
        coupleId,
        name,
        description,
        category,
        parentId,
        sortOrder: (maxSort._max.sortOrder || 0) + 1
      }
    });

    res.status(201).json({
      message: 'Запись реестра создана',
      entry
    });
  } catch (error) {
    console.error('Create registry entry error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function getRegistry(req, res) {
  const coupleId = parseInt(req.params.coupleId, 10);

  if (Number.isNaN(coupleId)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Некорректный ID пары',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const entries = await prisma.kinshipRegistry.findMany({
      where: { coupleId },
      orderBy: { sortOrder: 'asc' }
    });

    const buildTree = (parentId = null) =>
      entries
        .filter(e => e.parentId === parentId)
        .map(e => ({
          ...e,
          children: buildTree(e.id)
        }));

    const registryTree = buildTree(null);

    const grouped = {
      ATA_ANA: entries.filter(e => e.category === 'ATA_ANA'),
      ZHIEN_ZhARAN: entries.filter(e => e.category === 'ZHIEN_ZhARAN'),
      KUDA_ZHEKZhEN: entries.filter(e => e.category === 'KUDA_ZHEKZhEN')
    };

    res.json({
      coupleId,
      entries,
      tree: registryTree,
      grouped
    });
  } catch (error) {
    console.error('Get registry error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Не удалось получить реестр родства',
      timestamp: new Date().toISOString()
    });
  }
}

async function getGiftsByKinship(req, res) {
  const guestId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const familyEntry = await prisma.familyTree.findFirst({
      where: { guestId }
    });

    if (!familyEntry) {
      return res.json({
        gifts: [],
        pagination: { page, limit, total: 0, pages: 0 },
        message: 'Вы ещё не добавлены в родословную'
      });
    }

    const userTier = familyEntry.kinshipTier;
    const userCategory = familyEntry.category;
    
    const visibleCategories = TIER_VISIBILITY[userTier] || [userCategory];

    const allGifts = await prisma.gift.findMany({
      where: {
        coupleId: familyEntry.coupleId,
        status: { not: 'paid_out' }
      },
      orderBy: { createdAt: 'desc' }
    });

    const visibleGifts = allGifts.filter((gift) => {
      if (!Array.isArray(gift.allowedTiers)) return false;
      return gift.allowedTiers.includes(userTier);
    });

    const gifts = visibleGifts.slice(skip, skip + limit);

    res.json({
      guestTier: userTier,
      guestCategory: userCategory,
      gifts: gifts.map(gift => ({
        id: gift.id,
        name: gift.name,
        description: gift.description,
        targetAmount: gift.targetAmount,
        fundedAmount: gift.fundedAmount,
        remainingAmount: gift.targetAmount - gift.fundedAmount,
        progressPercent: (gift.fundedAmount / gift.targetAmount) * 100,
        currency: gift.currency,
        status: gift.status,
        allowedTiers: gift.allowedTiers
      })),
      pagination: {
        page,
        limit,
        total: visibleGifts.length,
        pages: Math.max(1, Math.ceil(visibleGifts.length / limit))
      }
    });
  } catch (error) {
    console.error('Get gifts by kinship error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Не удалось получить подарки',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  addFamilyMember,
  getMyKinship,
  getFamilyTree,
  createRegistryEntry,
  getRegistry,
  getGiftsByKinship
};
