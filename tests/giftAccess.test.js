/**
 * Тесты для Gift Access Middleware (DI-стиль)
 *
 * Проверяем:
 *   1. requireGiftAccess — отклоняет неаутентифицированных пользователей с 403
 *   2. requireGiftAccess — пропускает администратора
 *   3. requireGiftAccess — пропускает владельца (couple)
 *   4. requireGiftAccess — отклоняет гостя без родословной с 403
 *   5. requireGiftAccess — отклоняет гостя с неверным тиром с 403
 *   6. requireGiftAccess — пропускает гостя с правильным тиром
 *   7. loadGift — загружает подарок в req.gift
 *   8. loadGift — 404 при отсутствии подарка
 *   9. loadAndCheckGiftAccess — комбинированный middleware
 *  10. isGiftPublic — проверка публичного подарка
 */

const { requireGiftAccess, loadGift, isGiftPublic, getKinshipTier } = require('../src/middleware/giftAccess');

// ─── Моки ────────────────────────────────────────────────────────────────

const mockFamilyTree = {
  findFirst: jest.fn(),
};

jest.mock('../src/config/database', () => ({
  prisma: {
    familyTree: {
      findFirst: jest.fn(),
    },
    gift: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const { prisma } = require('../src/config/database');

function createMockReq(gift, user = null) {
  return {
    gift,
    user,
    params: {},
    query: {},
    body: {},
  };
}

function createMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─── Тесты ───────────────────────────────────────────────────────────────

describe('Gift Access Middleware (DI-стиль)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── 1. Неаутентифицированный пользователь → 403 ──────────────────
  describe('requireGiftAccess', () => {
    test('должен вернуть 403 для неаутентифицированного пользователя (приватный подарок)', async () => {
      const req = createMockReq(
        { id: 1, coupleId: 1, allowedTiers: ['ata_ana'] }, // приватный подарок
        null // не аутентифицирован
      );
      const res = createMockRes();
      const next = jest.fn();

      await requireGiftAccess()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('должен пропустить неаутентифицированного пользователя для публичного подарка', async () => {
      const req = createMockReq(
        {
          id: 2,
          coupleId: 1,
          allowedTiers: ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'], // публичный
        },
        null
      );
      const res = createMockRes();
      const next = jest.fn();

      await requireGiftAccess()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    // ─── 2. Администратор → пропускаем ─────────────────────────────
    test('должен пропустить администратора', async () => {
      const req = createMockReq(
        { id: 1, coupleId: 1, allowedTiers: ['ata_ana'] },
        { id: 999, role: 'admin' }
      );
      const res = createMockRes();
      const next = jest.fn();

      await requireGiftAccess()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    // ─── 3. Владелец (couple) → пропускаем ─────────────────────────
    test('должен пропустить владельца-пару', async () => {
      const req = createMockReq(
        { id: 1, coupleId: 42 },
        { id: 42, role: 'couple' }
      );
      const res = createMockRes();
      const next = jest.fn();

      await requireGiftAccess()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.kinshipTier).toBeNull();
    });

    // ─── 4. Гость без родословной → 403 ─────────────────────────────
    test('должен вернуть 403 для гостя без родословной', async () => {
      prisma.familyTree.findFirst.mockResolvedValue(null);

      const req = createMockReq(
        { id: 1, coupleId: 1, allowedTiers: ['ata_ana'] },
        { id: 100, role: 'guest' }
      );
      const res = createMockRes();
      const next = jest.fn();

      await requireGiftAccess()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: expect.stringContaining('родословную'),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    // ─── 5. Гость с неверным тиром → 403 ──────────────────────────
    test('должен вернуть 403 для гостя с неверным тиром', async () => {
      prisma.familyTree.findFirst.mockResolvedValue({ kinshipTier: 'kuda_zhekzhen' });

      const req = createMockReq(
        { id: 1, coupleId: 1, allowedTiers: ['ata_ana'] }, // только для ata_ana
        { id: 100, role: 'guest' }
      );
      const res = createMockRes();
      const next = jest.fn();

      await requireGiftAccess()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: expect.stringContaining('тира'),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    // ─── 6. Гость с правильным тиром → пропускаем ─────────────────
    test('должен пропустить гостя с правильным тиром и установить kinshipTier', async () => {
      prisma.familyTree.findFirst.mockResolvedValue({ kinshipTier: 'zhien_zaran' });

      const req = createMockReq(
        { id: 1, coupleId: 1, allowedTiers: ['zhien_zaran', 'kuda_zhekzhen'] },
        { id: 100, role: 'guest' }
      );
      const res = createMockRes();
      const next = jest.fn();

      await requireGiftAccess()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.kinshipTier).toBe('zhien_zaran');
    });

    // ─── 6b. Ata_ana видит все ────────────────────────────────────
    test('Ata_ana должен видеть подарки для всех тиров', async () => {
      prisma.familyTree.findFirst.mockResolvedValue({ kinshipTier: 'ata_ana' });

      const req = createMockReq(
        { id: 1, coupleId: 1, allowedTiers: ['kuda_zhekzhen'] },
        { id: 100, role: 'guest' }
      );
      const res = createMockRes();
      const next = jest.fn();

      await requireGiftAccess()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.kinshipTier).toBe('ata_ana');
    });

    // ─── 7. req.gift отсутствует → 500 ─────────────────────────────
    test('должен вернуть 500 если req.gift отсутствует', async () => {
      const req = createMockReq(null, { id: 1, role: 'couple' });
      const res = createMockRes();
      const next = jest.fn();

      await requireGiftAccess()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'CONFIG_ERROR' })
      );
    });
  });

  // ─── loadGift ───────────────────────────────────────────────────────
  describe('loadGift', () => {
    test('должен загрузить подарок и поместить в req.gift', async () => {
      const mockGift = { id: 1, name: 'Test Gift', coupleId: 1 };
      prisma.gift.findUnique.mockResolvedValue(mockGift);

      const req = { params: { giftId: '1' }, body: {}, query: {} };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = loadGift();
      await middleware(req, res, next);

      expect(req.gift).toEqual(mockGift);
      expect(next).toHaveBeenCalled();
    });

    test('должен вернуть 404 если подарок не найден', async () => {
      prisma.gift.findUnique.mockResolvedValue(null);

      const req = { params: { giftId: '999' }, body: {}, query: {} };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = loadGift();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    test('должен вернуть 400 если giftId отсутствует', async () => {
      const req = { params: {}, body: {}, query: {} };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = loadGift();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    test('должен поддерживать giftIdSource: body.giftId', async () => {
      const mockGift = { id: 2, name: 'Body Gift' };
      prisma.gift.findUnique.mockResolvedValue(mockGift);

      const req = { params: {}, body: { giftId: 2 }, query: {} };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = loadGift({ giftIdSource: 'body.giftId' });
      await middleware(req, res, next);

      expect(req.gift).toEqual(mockGift);
      expect(next).toHaveBeenCalled();
    });

    test('должен работать когда required=false и подарка нет', async () => {
      prisma.gift.findUnique.mockResolvedValue(null);

      const req = { params: { giftId: '999' }, body: {}, query: {} };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = loadGift({ required: false });
      await middleware(req, res, next);

      expect(req.gift).toBeNull();
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── isGiftPublic ───────────────────────────────────────────────────
  describe('isGiftPublic', () => {
    test('должен вернуть true для подарка со всеми тремя тирами', () => {
      const gift = { allowedTiers: ['ata_ana', 'zhien_zaran', 'kuda_zhekzhen'] };
      expect(isGiftPublic(gift)).toBe(true);
    });

    test('должен вернуть false для подарка только с одним тиром', () => {
      const gift = { allowedTiers: ['ata_ana'] };
      expect(isGiftPublic(gift)).toBe(false);
    });

    test('должен вернуть false если allowedTiers не массив', () => {
      expect(isGiftPublic({})).toBe(false);
      expect(isGiftPublic({ allowedTiers: null })).toBe(false);
      expect(isGiftPublic({ allowedTiers: 'ata_ana' })).toBe(false);
    });
  });
});
