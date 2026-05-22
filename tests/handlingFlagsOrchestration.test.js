/**
 * Тесты для динамической оркестрации флагов транспортировки
 *
 * Проверяем:
 *   1. createFlagChain — создание цепочки флагов
 *   2. propagateFlagsToStage — проталкивание флагов на новый этап
 *   3. summarizeFlagChain — сводка по цепочке
 *   4. validateLogisticsTransition — валидация перехода
 *   5. orchestrateLifecycleFlags — полная оркестрация
 *   6. lifecycle сквозной тест (pending → delivered)
 */

const {
  createFlagChain,
  propagateFlagsToStage,
  summarizeFlagChain,
  validateLogisticsTransition,
  orchestrateLifecycleFlags,
  calculateDeliveryComplexity,
} = require('../src/services/handlingFlagsService');

describe('Handling Flags — Динамическая оркестрация', () => {
  // ─── createFlagChain ─────────────────────────────────────────────────
  describe('createFlagChain', () => {
    test('создаёт цепочку с правильными флагами на этапе pending', () => {
      const chain = createFlagChain(['FRAGILE', 'VALUABLE']);

      expect(chain).toHaveLength(2);
      expect(chain[0]).toMatchObject({
        flag: 'FRAGILE',
        stage: 'pending',
      });
      expect(chain[1]).toMatchObject({
        flag: 'VALUABLE',
        stage: 'pending',
      });
      expect(chain[0].propagatedAt).toBeDefined();
      expect(Date.parse(chain[0].propagatedAt)).not.toBeNaN();
    });

    test('возвращает пустой массив если флагов нет', () => {
      expect(createFlagChain([])).toEqual([]);
      expect(createFlagChain(null)).toEqual([]);
      expect(createFlagChain(undefined)).toEqual([]);
    });

    test('фильтрует невалидные флаги', () => {
      const chain = createFlagChain(['FRAGILE', 'INVALID_FLAG', 'HEAVY']);
      expect(chain).toHaveLength(2);
      expect(chain.map(c => c.flag)).toEqual(['FRAGILE', 'HEAVY']);
    });
  });

  // ─── propagateFlagsToStage ──────────────────────────────────────────
  describe('propagateFlagsToStage', () => {
    test('добавляет записи для каждого флага на новом этапе', () => {
      const existingChain = createFlagChain(['FRAGILE']);
      const updated = propagateFlagsToStage(existingChain, ['FRAGILE', 'VALUABLE'], 'funding');

      expect(updated).toHaveLength(3); // 1 pending + 2 funding
      expect(updated.filter(e => e.stage === 'funding')).toHaveLength(2);
      expect(updated.filter(e => e.stage === 'pending')).toHaveLength(1);
    });

    test('корректно проходит через все этапы', () => {
      const stages = ['pending', 'funding', 'funded', 'purchased', 'delivered'];
      let chain = [];
      const flags = ['FRAGILE'];

      for (const stage of stages) {
        chain = propagateFlagsToStage(chain, flags, stage);
      }

      expect(chain).toHaveLength(stages.length); // один флаг × 5 этапов
      const coveredStages = [...new Set(chain.map(e => e.stage))];
      expect(coveredStages).toEqual(stages);
    });

    test('возвращает существующую цепочку если флагов нет', () => {
      const existing = [{ flag: 'FRAGILE', stage: 'pending', propagatedAt: '2024-01-01' }];
      expect(propagateFlagsToStage(existing, [], 'funding')).toEqual(existing);
    });
  });

  // ─── summarizeFlagChain ─────────────────────────────────────────────
  describe('summarizeFlagChain', () => {
    test('возвращает правильную сводку', () => {
      const chain = [
        { flag: 'FRAGILE', stage: 'pending', propagatedAt: '2024-01-01T00:00:00Z' },
        { flag: 'FRAGILE', stage: 'funding', propagatedAt: '2024-01-02T00:00:00Z' },
        { flag: 'VALUABLE', stage: 'pending', propagatedAt: '2024-01-01T00:00:00Z' },
      ];

      const summary = summarizeFlagChain(chain);

      expect(summary.totalPropagations).toBe(3);
      expect(summary.uniqueFlags).toHaveLength(2);
      expect(summary.stagesCovered).toEqual(['pending', 'funding']);
      expect(summary.startedAt).toBe('2024-01-01T00:00:00Z');
      expect(summary.lastPropagatedAt).toBe('2024-01-02T00:00:00Z');
    });

    test('возвращает пустую сводку для пустой цепочки', () => {
      const summary = summarizeFlagChain([]);
      expect(summary.totalPropagations).toBe(0);
      expect(summary.uniqueFlags).toEqual([]);
      expect(summary.stagesCovered).toEqual([]);
    });
  });

  // ─── validateLogisticsTransition ────────────────────────────────────
  describe('validateLogisticsTransition', () => {
    test('разрешает переход без флагов', () => {
      const result = validateLogisticsTransition([], 'funded', 'purchased');
      expect(result.canProceed).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.blocks).toEqual([]);
    });

    test('добавляет предупреждение о страховке для VALUABLE', () => {
      const result = validateLogisticsTransition(['VALUABLE'], 'funded', 'purchased');
      expect(result.canProceed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('страховку'))).toBe(true);
    });

    test('добавляет предупреждения о спецтранспорте при доставке', () => {
      const result = validateLogisticsTransition(['OVERSIZE'], 'purchased', 'delivered');
      expect(result.canProceed).toBe(true);
      expect(result.warnings.some(w => w.includes('спецтранспорт'))).toBe(true);
    });

    test('добавляет предупреждение о подписи для VALUABLE при доставке', () => {
      const result = validateLogisticsTransition(['VALUABLE'], 'purchased', 'delivered');
      expect(result.warnings.some(w => w.includes('подпись'))).toBe(true);
    });

    test('добавляет предупреждение о персонале для HEAVY при доставке', () => {
      const result = validateLogisticsTransition(['HEAVY'], 'purchased', 'delivered');
      expect(result.warnings.some(w => w.includes('грузчик'))).toBe(true);
    });
  });

  // ─── orchestrateLifecycleFlags ──────────────────────────────────────
  describe('orchestrateLifecycleFlags', () => {
    test('возвращает полный отчёт для purchased с FRAGILE+VALUABLE', () => {
      const result = orchestrateLifecycleFlags({
        flags: ['FRAGILE', 'VALUABLE'],
        fromStage: 'funded',
        toStage: 'purchased',
        giftInfo: { name: 'Ваза' },
      });

      expect(result.stage).toBe('purchased');
      expect(result.flags).toEqual(['FRAGILE', 'VALUABLE']);
      expect(result.flagsAnnotated).toHaveLength(2);
      expect(result.manifest).toBeDefined();
      expect(result.deliveryComplexity).toBeDefined();
      expect(result.flagChain).toHaveLength(2); // 2 флага на purchased
      expect(result.deliveryNote).toBeTruthy();
      expect(result.packagingRequirements.requiresPackaging).toBe(true);
    });

    test('возвращает полный отчёт для delivered (финальный)', () => {
      const result = orchestrateLifecycleFlags({
        flags: ['FRAGILE', 'VALUABLE', 'OVERSIZE'],
        fromStage: 'purchased',
        toStage: 'delivered',
        flagChain: [
          { flag: 'FRAGILE', stage: 'pending', propagatedAt: '2024-01-01T00:00:00Z' },
          { flag: 'FRAGILE', stage: 'funding', propagatedAt: '2024-01-02T00:00:00Z' },
        ],
        giftInfo: { name: 'Стеклянная люстра' },
      });

      expect(result.stage).toBe('delivered');
      expect(result.flagChain).toHaveLength(5); // 2 existing + 3 новых
      expect(result.flagChainSummary.totalPropagations).toBe(5);
      expect(result.transitionValidation.canProceed).toBe(true);
      expect(result.transitionValidation.warnings.length).toBeGreaterThan(0); // спецтранспорт, страховка
      expect(result.lifecycleContext).toBeDefined();
      expect(result.lifecycleContext.completionReport).toBeDefined();
    });

    test('возвращает базовый отчёт для standard подарка (без флагов)', () => {
      const result = orchestrateLifecycleFlags({
        flags: [],
        fromStage: 'pending',
        toStage: 'funded',
      });

      expect(result.stage).toBe('funded');
      expect(result.flags).toEqual([]);
      expect(result.flagsAnnotated).toEqual([]);
      expect(result.flagChain).toEqual([]);
      expect(result.deliveryComplexity.level).toBe('standard');
    });
  });

  // ─── Сквозной lifecycle тест ────────────────────────────────────────
  describe('Lifecycle сквозной тест — FRAGILE + VALUABLE', () => {
    const flags = ['FRAGILE', 'VALUABLE'];

    test('этап 1: pending — создание флагов через orchestrateLifecycleFlags', () => {
      // orchestrateLifecycleFlags сам создаёт propagate через toStage
      const result = orchestrateLifecycleFlags({
        flags,
        fromStage: null,
        toStage: 'pending',
        flagChain: [], // начинаем с пустой цепочки
      });

      expect(result.stage).toBe('pending');
      expect(result.flagChain).toHaveLength(2); // 2 флага × pending
      expect(result.flagChainSummary.stagesCovered).toEqual(['pending']);
      expect(result.lifecycleContext.stageInstructions).toContain('установлены');
    });

    test('этап 2: funding — флаги протекают через orchestrateLifecycleFlags', () => {
      const prevChain = createFlagChain(flags); // pending: 2 записи

      // orchestrateLifecycleFlags сам добавит funding
      const result = orchestrateLifecycleFlags({
        flags,
        fromStage: 'pending',
        toStage: 'funding',
        flagChain: prevChain,
      });

      expect(result.stage).toBe('funding');
      // 2 (pending) + 2 (funding) = 4
      expect(result.flagChainSummary.totalPropagations).toBe(4);
    });

    test('этап 3: funded — планирование логистики', () => {
      // Симулируем, что прошло 2 этапа: pending + funding
      let chain = createFlagChain(flags);
      chain = propagateFlagsToStage(chain, flags, 'funding');
      // теперь chain: 4 записи (2 pending + 2 funding)

      const result = orchestrateLifecycleFlags({
        flags,
        fromStage: 'funding',
        toStage: 'funded',
        flagChain: chain,
      });

      expect(result.stage).toBe('funded');
      // 4 + 2 (funded) = 6
      expect(result.flagChainSummary.totalPropagations).toBe(6);
      expect(result.lifecycleContext.planningRequired).toBeDefined();
    });

    test('этап 4: purchased — манифест готов', () => {
      // Симулируем: pending + funding + funded
      let chain = createFlagChain(flags);
      chain = propagateFlagsToStage(chain, flags, 'funding');
      chain = propagateFlagsToStage(chain, flags, 'funded');
      // chain: 6 записей

      const result = orchestrateLifecycleFlags({
        flags,
        fromStage: 'funded',
        toStage: 'purchased',
        flagChain: chain,
        giftInfo: { name: 'Хрустальная ваза' },
      });

      expect(result.stage).toBe('purchased');
      // 6 + 2 (purchased) = 8
      expect(result.flagChainSummary.totalPropagations).toBe(8);
      expect(result.manifest).toBeDefined();
      expect(result.transitionValidation.warnings.some(w => w.includes('страховку'))).toBe(true);

      // Проверяем манифест
      expect(result.manifest.logisticsRequirements.insurance.required).toBe(true);
      expect(result.manifest.logisticsRequirements.signatureRequired).toBe(true);
    });

    test('этап 5: delivered — финальный отчёт (полный lifecycle)', () => {
      // Симулируем полный lifecycle: pending + funding + funded + purchased
      let chain = createFlagChain(flags);
      chain = propagateFlagsToStage(chain, flags, 'funding');
      chain = propagateFlagsToStage(chain, flags, 'funded');
      chain = propagateFlagsToStage(chain, flags, 'purchased');
      // chain: 8 записей

      const result = orchestrateLifecycleFlags({
        flags,
        fromStage: 'purchased',
        toStage: 'delivered',
        flagChain: chain,
        giftInfo: { name: 'Хрустальная ваза' },
      });

      expect(result.stage).toBe('delivered');
      // 8 + 2 (delivered) = 10 — 2 flags × 5 stages
      expect(result.flagChainSummary.totalPropagations).toBe(10);

      // ── Чистый тест orchestrateLifecycleFlags с нуля ──────────────
      // Создаём полную цепочку с нуля через orchestrateLifecycleFlags
      let currentChain = [];
      for (const stage of ['pending', 'funding', 'funded', 'purchased', 'delivered']) {
        const res = orchestrateLifecycleFlags({
          flags,
          fromStage: null,
          toStage: stage,
          flagChain: currentChain,
        });
        currentChain = res.flagChain;
      }

      expect(currentChain).toHaveLength(10);
      expect(result.flagChainSummary.uniqueFlags).toHaveLength(2);
      expect(result.flagChainSummary.stagesCovered).toEqual([
        'pending', 'funding', 'funded', 'purchased', 'delivered',
      ]);
      expect(result.lifecycleContext.completionReport).toBeDefined();
      expect(result.lifecycleContext.completionReport.flagsHandled).toEqual(['FRAGILE', 'VALUABLE']);

      // Финальная сложность — FRAGILE(2) + VALUABLE(3) = 5 → special
      expect(result.deliveryComplexity.level).toBe('special');
      expect(result.deliveryComplexity.score).toBe(5); // 2 (FRAGILE) + 3 (VALUABLE)
    });
  });

  // ─── Тест сложности ─────────────────────────────────────────────────
  describe('calculateDeliveryComplexity', () => {
    test('standard для подарка без флагов', () => {
      expect(calculateDeliveryComplexity([]).level).toBe('standard');
    });

    test('attention для одного-двух баллов', () => {
      expect(calculateDeliveryComplexity(['LIQUID']).level).toBe('attention');
      expect(calculateDeliveryComplexity(['ELECTRONICS']).level).toBe('attention');
    });

    test('special для трёх-пяти баллов', () => {
      expect(calculateDeliveryComplexity(['FRAGILE', 'VALUABLE']).level).toBe('special'); // 2+3=5
      expect(calculateDeliveryComplexity(['PERISHABLE']).level).toBe('special'); // 3
      expect(calculateDeliveryComplexity(['OVERSIZE']).level).toBe('special'); // 3
    });

    test('complex для шести+ баллов', () => {
      expect(calculateDeliveryComplexity(['PERISHABLE', 'OVERSIZE', 'VALUABLE']).level).toBe('complex'); // 9
      expect(calculateDeliveryComplexity(['FRAGILE', 'OVERSIZE', 'TEMP_CONTROLLED']).level).toBe('complex'); // 8
    });
  });
});
