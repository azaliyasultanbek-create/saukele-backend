/**
 * Handling Flags Service
 *
 * Специальные флаги транспортировки (fragile-item handling flags),
 * которые тянутся по всей цепочке доставки:
 *
 *   pending ──► funding ──► funded ──► purchased ──► delivered
 *
 * Флаги задаются при создании подарка (couple) и проходят сквозь
 * все состояния жизненного цикла, чтобы на этапе доставки все
 * участники цепочки знали об особых условиях обращения с предметом.
 *
 * ДИНАМИЧЕСКАЯ ОРКЕСТРАЦИЯ ФЛАГОВ:
 *   — Флаги "протекают" (propagate) через все этапы жизненного цикла
 *   — На каждом этапе флаги дополняются контекстом конкретного этапа
 *   — При переходе между этапами проверяется полнота логистических требований
 *   — Формируется цепочка флагов (flag chain) с отметками времени
 *
 * Доступные флаги:
 *   FRAGILE       — хрупкий предмет (стекло, керамика, электроника)
 *   PERISHABLE    — скоропортящийся (требует холодильника/особого режима)
 *   OVERSIZE      — крупногабаритный (требует спецтранспорта)
 *   LIQUID        — жидкость (герметичная упаковка, ориентация)
 *   HEAVY         — тяжёлый (вес > 20 кг, нужны грузчики)
 *   VALUABLE      — ценный (страховка, подпись при получении)
 *   TEMP_CONTROLLED — требует температурного контроля
 *   ELECTRONICS   — электроника (антистатик, защита от ударов)
 */

// ─── Определения флагов ─────────────────────────────────────────────────

const HANDLING_FLAGS = {
  FRAGILE: {
    code: 'FRAGILE',
    label: 'Хрупкое',
    labelEn: 'Fragile',
    description: 'Хрупкий предмет — требуется бережная транспортировка',
    icon: 'fragile',
    requiresPackaging: true,
    requiresSignature: false,
    requiresInsurance: false,
    requiresSpecialTransport: false,
    requiresExtraStaff: false,
    deliveryNote: 'Обращаться с осторожностью! Хрупкий груз.',
  },
  PERISHABLE: {
    code: 'PERISHABLE',
    label: 'Скоропортящееся',
    labelEn: 'Perishable',
    description: 'Скоропортящийся товар — требует холодильного режима',
    icon: 'perishable',
    requiresPackaging: true,
    requiresSignature: false,
    requiresInsurance: false,
    requiresSpecialTransport: true,
    requiresExtraStaff: false,
    deliveryNote: 'Хранить в холоде! Скоропортящийся продукт.',
  },
  OVERSIZE: {
    code: 'OVERSIZE',
    label: 'Крупногабаритное',
    labelEn: 'Oversize',
    description: 'Крупногабаритный предмет — требуется спецтранспорт',
    icon: 'oversize',
    requiresPackaging: false,
    requiresSignature: false,
    requiresInsurance: false,
    requiresSpecialTransport: true,
    requiresExtraStaff: true,
    deliveryNote: 'Крупногабаритный груз. Требуется спецтранспорт.',
  },
  LIQUID: {
    code: 'LIQUID',
    label: 'Жидкость',
    labelEn: 'Liquid',
    description: 'Содержит жидкость — герметичная упаковка, вертикальное положение',
    icon: 'liquid',
    requiresPackaging: true,
    requiresSignature: false,
    requiresInsurance: false,
    requiresSpecialTransport: false,
    requiresExtraStaff: false,
    deliveryNote: 'Верх! Не кантовать. Герметичная упаковка обязательна.',
  },
  HEAVY: {
    code: 'HEAVY',
    label: 'Тяжёлое',
    labelEn: 'Heavy',
    description: 'Тяжёлый предмет (>20 кг) — требуется двое грузчиков',
    icon: 'heavy',
    requiresPackaging: false,
    requiresSignature: false,
    requiresInsurance: false,
    requiresSpecialTransport: false,
    requiresExtraStaff: true,
    deliveryNote: 'Тяжёлый груз. Требуется два грузчика.',
  },
  VALUABLE: {
    code: 'VALUABLE',
    label: 'Ценное',
    labelEn: 'Valuable',
    description: 'Ценный предмет — страховка и подпись при получении',
    icon: 'valuable',
    requiresPackaging: true,
    requiresSignature: true,
    requiresInsurance: true,
    requiresSpecialTransport: false,
    requiresExtraStaff: false,
    deliveryNote: 'Ценный груз! Страховка обязательна. Подпись при получении.',
  },
  TEMP_CONTROLLED: {
    code: 'TEMP_CONTROLLED',
    label: 'Температурный режим',
    labelEn: 'Temperature Controlled',
    description: 'Требует температурного контроля при транспортировке',
    icon: 'temp_controlled',
    requiresPackaging: true,
    requiresSignature: false,
    requiresInsurance: false,
    requiresSpecialTransport: true,
    requiresExtraStaff: false,
    deliveryNote: 'Температурный режим! Поддерживать заданную температуру.',
  },
  ELECTRONICS: {
    code: 'ELECTRONICS',
    label: 'Электроника',
    labelEn: 'Electronics',
    description: 'Электроника — антистатическая упаковка, защита от ударов',
    icon: 'electronics',
    requiresPackaging: true,
    requiresSignature: false,
    requiresInsurance: false,
    requiresSpecialTransport: false,
    requiresExtraStaff: false,
    deliveryNote: 'Электроника! Антистатическая упаковка. Беречь от ударов.',
  },
};

const ALL_VALID_FLAGS = Object.values(HANDLING_FLAGS).map(f => f.code);

// ─── Категоризация флагов по логистическим требованиям ───────────────────

const FLAG_CATEGORIES = {
  PACKAGING: Object.values(HANDLING_FLAGS)
    .filter(f => f.requiresPackaging)
    .map(f => f.code),

  SIGNATURE_REQUIRED: Object.values(HANDLING_FLAGS)
    .filter(f => f.requiresSignature)
    .map(f => f.code),

  INSURANCE_REQUIRED: Object.values(HANDLING_FLAGS)
    .filter(f => f.requiresInsurance)
    .map(f => f.code),

  SPECIAL_TRANSPORT: Object.values(HANDLING_FLAGS)
    .filter(f => f.requiresSpecialTransport)
    .map(f => f.code),

  EXTRA_STAFF: Object.values(HANDLING_FLAGS)
    .filter(f => f.requiresExtraStaff)
    .map(f => f.code),
};

// ─── Совместимость флагов ────────────────────────────────────────────────

const FLAG_COMPATIBILITY = {
  COMPATIBLE_GROUPS: {
    fragile_electronics: ['FRAGILE', 'ELECTRONICS'],
    valuable_fragile: ['VALUABLE', 'FRAGILE'],
    heavy_oversize: ['HEAVY', 'OVERSIZE'],
    liquid_perishable: ['LIQUID', 'PERISHABLE'],
    temp_perishable: ['TEMP_CONTROLLED', 'PERISHABLE'],
  },

  CONFLICTS: [
    { flags: ['LIQUID', 'ELECTRONICS'], severity: 'warning', message: 'Жидкость и электроника требуют особого внимания при совместной транспортировке' },
    { flags: ['PERISHABLE', 'ELECTRONICS'], severity: 'warning', message: 'Скоропортящиеся продукты и электроника обычно транспортируются раздельно' },
  ],
};

// ─── Валидация ──────────────────────────────────────────────────────────

function validateHandlingFlags(flags) {
  if (!Array.isArray(flags)) {
    return { valid: false, invalidFlags: ['flags must be an array'], validFlags: [] };
  }

  const invalidFlags = flags.filter(f => !ALL_VALID_FLAGS.includes(f));
  const validFlags = flags.filter(f => ALL_VALID_FLAGS.includes(f));

  return {
    valid: invalidFlags.length === 0,
    invalidFlags,
    validFlags,
  };
}

function checkFlagCompatibility(flags) {
  if (!Array.isArray(flags) || flags.length < 2) {
    return { hasConflicts: false, conflicts: [] };
  }

  const conflicts = [];

  for (const conflict of FLAG_COMPATIBILITY.CONFLICTS) {
    const hasAll = conflict.flags.every(f => flags.includes(f));
    if (hasAll) {
      conflicts.push({
        severity: conflict.severity,
        message: conflict.message,
        conflictingFlags: conflict.flags,
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

function getFlagInfo(code) {
  return HANDLING_FLAGS[code] || null;
}

function annotateFlags(flags) {
  if (!Array.isArray(flags)) return [];
  return flags
    .map(code => HANDLING_FLAGS[code])
    .filter(Boolean);
}

function buildDeliveryNote(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return '';
  const notes = flags
    .map(code => HANDLING_FLAGS[code]?.deliveryNote)
    .filter(Boolean);
  return notes.join(' | ');
}

function getPackagingRequirements(flags) {
  if (!Array.isArray(flags) || flags.length === 0) {
    return { requiresPackaging: false, packagingReason: '' };
  }

  const needPackaging = flags
    .map(code => HANDLING_FLAGS[code])
    .filter(f => f && f.requiresPackaging)
    .map(f => f.label);

  if (needPackaging.length === 0) {
    return { requiresPackaging: false, packagingReason: '' };
  }

  return {
    requiresPackaging: true,
    packagingReason: `Требуется специальная упаковка: ${needPackaging.join(', ')}.`,
  };
}

// ─── Оркестрационные функции (Logistics Orchestration) ───────────────────

/**
 * Сформировать полный логистический манифест для подарка на основе флагов.
 * Используется на этапах purchased → delivered для передачи в службу доставки.
 *
 * @param {string[]} flags - массив кодов флагов
 * @param {object} [giftInfo] - дополнительная информация о подарке
 * @param {string} [giftInfo.name] - название подарка
 * @param {number} [giftInfo.targetAmount] - сумма
 * @param {string} [giftInfo.currency] - валюта
 * @returns {object} логистический манифест
 */
function buildLogisticsManifest(flags, giftInfo = {}) {
  const annotated = annotateFlags(flags);

  // Определяем необходимые ресурсы на основе флагов
  const requiresSpecialTransport = flags.some(f => FLAG_CATEGORIES.SPECIAL_TRANSPORT.includes(f));
  const requiresExtraStaff = flags.some(f => FLAG_CATEGORIES.EXTRA_STAFF.includes(f));
  const requiresInsurance = flags.some(f => FLAG_CATEGORIES.INSURANCE_REQUIRED.includes(f));
  const requiresSignature = flags.some(f => FLAG_CATEGORIES.SIGNATURE_REQUIRED.includes(f));
  const packaging = getPackagingRequirements(flags);

  return {
    manifestVersion: '1.0',
    generatedAt: new Date().toISOString(),
    gift: giftInfo.name ? { name: giftInfo.name } : undefined,
    flags: annotated,
    deliveryNote: buildDeliveryNote(flags),
    logisticsRequirements: {
      specialTransport: {
        required: requiresSpecialTransport,
        reason: requiresSpecialTransport
          ? annotateFlags(flags.filter(f => FLAG_CATEGORIES.SPECIAL_TRANSPORT.includes(f)))
              .map(f => f.label)
              .join(', ')
          : '',
      },
      extraStaff: {
        required: requiresExtraStaff,
        count: requiresExtraStaff ? 2 : 0,
        reason: requiresExtraStaff
          ? annotateFlags(flags.filter(f => FLAG_CATEGORIES.EXTRA_STAFF.includes(f)))
              .map(f => f.label)
              .join(', ')
          : '',
      },
      insurance: {
        required: requiresInsurance,
        reason: requiresInsurance
          ? 'Ценный груз — обязательное страхование'
          : '',
      },
      signatureRequired: requiresSignature,
      packaging,
    },
    // Флаги, сгруппированные по категориям для систем доставки
    orchestrationHints: {
      // Флаги, которые требуют внимания при упаковке
      packagingFlags: flags.filter(f => HANDLING_FLAGS[f]?.requiresPackaging),
      // Флаги, влияющие на выбор транспорта
      transportFlags: flags.filter(f => HANDLING_FLAGS[f]?.requiresSpecialTransport),
      // Флаги, влияющие на персонал
      staffingFlags: flags.filter(f => HANDLING_FLAGS[f]?.requiresExtraStaff),
      // Флаги, требующие подписи/страховки
      complianceFlags: flags.filter(f => HANDLING_FLAGS[f]?.requiresSignature || HANDLING_FLAGS[f]?.requiresInsurance),
    },
  };
}

/**
 * Получить флаги, релевантные для конкретного этапа жизненного цикла подарка.
 * Разные этапы требуют внимания к разным аспектам флагов.
 *
 * @param {string[]} flags - массив кодов флагов
 * @param {string} lifecycleStage - этап жизненного цикла
 *        ('pending' | 'funding' | 'funded' | 'purchased' | 'delivered')
 * @returns {object} - релевантные флаги и инструкции для данного этапа
 */
function getFlagsForLifecycleStage(flags, lifecycleStage) {
  if (!Array.isArray(flags) || flags.length === 0) {
    return { relevantFlags: [], stageInstructions: '' };
  }

  const annotated = annotateFlags(flags);

  switch (lifecycleStage) {
    case 'pending':
    case 'funding':
      return {
        relevantFlags: annotated,
        stageInstructions: 'Флаги транспортировки установлены. Будут применены при доставке.',
      };

    case 'funded':
      return {
        relevantFlags: annotated,
        stageInstructions: 'Средства собраны. Необходимо подготовить логистику с учётом флагов.',
        planningRequired: buildLogisticsManifest(flags),
      };

    case 'purchased':
      return {
        relevantFlags: annotated,
        stageInstructions: 'Товар куплен. Передать логистическому оператору манифест.',
        logisticsManifest: buildLogisticsManifest(flags),
      };

    case 'delivered':
      return {
        relevantFlags: annotated,
        stageInstructions: 'Доставлено. Флаги обработаны.',
        completionReport: {
          flagsHandled: annotated.map(f => f.code),
          deliveryNote: buildDeliveryNote(flags),
        },
      };

    default:
      return {
        relevantFlags: annotated,
        stageInstructions: '',
      };
  }
}

/**
 * Определить уровень сложности доставки на основе флагов.
 * 
 * @param {string[]} flags - массив кодов флагов
 * @returns {{ level: string, score: number, description: string }}
 */
function calculateDeliveryComplexity(flags) {
  if (!Array.isArray(flags) || flags.length === 0) {
    return { level: 'standard', score: 0, description: 'Стандартная доставка, особых требований нет.' };
  }

  let score = 0;

  if (flags.includes('FRAGILE')) score += 2;
  if (flags.includes('PERISHABLE')) score += 3;
  if (flags.includes('OVERSIZE')) score += 3;
  if (flags.includes('LIQUID')) score += 1;
  if (flags.includes('HEAVY')) score += 2;
  if (flags.includes('VALUABLE')) score += 3;
  if (flags.includes('TEMP_CONTROLLED')) score += 3;
  if (flags.includes('ELECTRONICS')) score += 1;

  let level, description;

  if (score === 0) {
    level = 'standard';
    description = 'Стандартная доставка, особых требований нет.';
  } else if (score <= 2) {
    level = 'attention';
    description = 'Требуется повышенное внимание при обработке.';
  } else if (score <= 5) {
    level = 'special';
    description = 'Специальные условия доставки. Требуется координация с логистом.';
  } else {
    level = 'complex';
    description = 'Комплексная доставка. Может потребоваться несколько этапов и спецтехника.';
  }

  return { level, score, description };
}

/**
 * Получить сводку по совместимым группам флагов из предустановленных шаблонов.
 * 
 * @param {string[]} flags - массив кодов флагов
 * @returns {Array<{ groupName: string, matched: boolean, flags: string[], label: string }>}
 */
function getMatchingFlagGroups(flags) {
  if (!Array.isArray(flags)) return [];

  const groups = [];
  for (const [groupName, groupFlags] of Object.entries(FLAG_COMPATIBILITY.COMPATIBLE_GROUPS)) {
    const matched = groupFlags.every(f => flags.includes(f));
    groups.push({
      groupName,
      matched,
      flags: groupFlags,
      label: groupFlags.map(f => HANDLING_FLAGS[f]?.label).filter(Boolean).join(' + '),
    });
  }

  return groups;
}

// ═══════════════════════════════════════════════════════════════════════════
// ДИНАМИЧЕСКАЯ ОРКЕСТРАЦИЯ ФЛАГОВ (Lifecycle Flag Propagation)
// ═══════════════════════════════════════════════════════════════════════════
//
// Флаги "протекают" через жизненный цикл подарка. На каждом этапе
// мы формируем контекст, который обогащается по мере продвижения.
//
// Поток флагов:
//   pending  ──►  funding  ──►  funded  ──►  purchased  ──►  delivered
//   (установка)   (инфо)       (планирование)  (манифест)     (отчёт)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Типы lifecycle-этапов с описанием, какие логистические действия
 * должны быть выполнены на каждом этапе.
 */
const LIFECYCLE_STAGES = {
  pending: {
    order: 0,
    label: 'Ожидание',
    labelEn: 'Pending',
    logisticsAction: 'flag_setup',
    description: 'Флаги установлены парой при создании подарка.',
  },
  funding: {
    order: 1,
    label: 'Сбор средств',
    labelEn: 'Funding',
    logisticsAction: 'flag_info',
    description: 'Флаги видны участникам сбора. Информация о требованиях к доставке.',
  },
  funded: {
    order: 2,
    label: 'Собрано',
    labelEn: 'Funded',
    logisticsAction: 'flag_planning',
    description: 'Средства собраны. Запускается логистическое планирование.',
  },
  purchased: {
    order: 3,
    label: 'Куплено',
    labelEn: 'Purchased',
    logisticsAction: 'flag_manifest',
    description: 'Товар куплен. Манифест передан логистическому оператору.',
  },
  delivered: {
    order: 4,
    label: 'Доставлено',
    labelEn: 'Delivered',
    logisticsAction: 'flag_report',
    description: 'Доставлено. Цепочка флагов завершена.',
  },
};

/**
 * Проверить, что логистические требования для данного этапа выполнены.
 * 
 * @param {string[]} flags - текущие флаги подарка
 * @param {string} fromStage - текущий этап
 * @param {string} toStage - целевой этап
 * @returns {{ canProceed: boolean, warnings: string[], blocks: string[] }}
 */
function validateLogisticsTransition(flags, fromStage, toStage) {
  const warnings = [];
  const blocks = [];

  if (!Array.isArray(flags) || flags.length === 0) {
    // Если флагов нет — никаких логистических требований
    return { canProceed: true, warnings: [], blocks: [] };
  }

  const annotated = annotateFlags(flags);

  // ── Проверки при переходе funded → purchased ──────────────────────
  if (toStage === 'purchased') {
    // Проверяем, что все конфликты флагов известны
    const compatibility = checkFlagCompatibility(flags);
    if (compatibility.hasConflicts) {
      compatibility.conflicts.forEach(c => {
        if (c.severity === 'warning') {
          warnings.push(`[${c.severity}] ${c.message}`);
        } else {
          blocks.push(c.message);
        }
      });
    }

    // Если есть VALUABLE — проверить, что страховка настроена
    if (flags.includes('VALUABLE')) {
      warnings.push('Требуется оформить страховку для ценного груза.');
    }
  }

  // ── Проверки при переходе purchased → delivered ───────────────────
  if (toStage === 'delivered') {
    // Флаги, требующие спецтранспорта
    if (flags.some(f => HANDLING_FLAGS[f]?.requiresSpecialTransport)) {
      const transportFlags = flags.filter(f => HANDLING_FLAGS[f]?.requiresSpecialTransport);
      const transportLabels = transportFlags.map(f => HANDLING_FLAGS[f]?.label).filter(Boolean);
      warnings.push(`Требуется спецтранспорт: ${transportLabels.join(', ')}.`);
    }

    // Флаги, требующие доп. персонала
    if (flags.some(f => HANDLING_FLAGS[f]?.requiresExtraStaff)) {
      const staffFlags = flags.filter(f => HANDLING_FLAGS[f]?.requiresExtraStaff);
      const staffLabels = staffFlags.map(f => HANDLING_FLAGS[f]?.label).filter(Boolean);
      warnings.push(`Требуется доп. персонал (грузчики): ${staffLabels.join(', ')}.`);
    }

    // Флаги, требующие подписи
    if (flags.some(f => HANDLING_FLAGS[f]?.requiresSignature)) {
      warnings.push('Требуется подпись получателя при вручении.');
    }
  }

  return {
    canProceed: blocks.length === 0,
    warnings,
    blocks,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ЦЕПОЧКИ ФЛАГОВ (Flag Chain / Propagation History)
// ═══════════════════════════════════════════════════════════════════════════
//
// Цепочка флагов — это массив записей вида:
//   { flag: 'FRAGILE', stage: 'pending', propagatedAt: <ISO timestamp> }
//
// Каждый раз, когда подарок переходит на новый этап, флаги "протекают"
// (propagate) и фиксируются в цепочке. Это позволяет отслеживать,
// на каком этапе какие флаги были активны.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создать новую цепочку флагов для подарка (при создании).
 * 
 * @param {string[]} flags - массив кодов флагов
 * @returns {Array<{ flag: string, stage: string, propagatedAt: string }>}
 */
function createFlagChain(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return [];

  const now = new Date().toISOString();
  const chain = [];

  for (const flag of flags) {
    if (ALL_VALID_FLAGS.includes(flag)) {
      chain.push({
        flag,
        stage: 'pending',
        propagatedAt: now,
      });
    }
  }

  return chain;
}

/**
 * "Протолкнуть" (propagate) флаги на следующий этап жизненного цикла.
 * Добавляет записи в цепочку для каждого флага.
 * 
 * @param {Array<{ flag: string, stage: string, propagatedAt: string }>} existingChain - текущая цепочка
 * @param {string[]} currentFlags - текущие флаги подарка
 * @param {string} newStage - новый этап ('funding' | 'funded' | 'purchased' | 'delivered')
 * @returns {Array} — обновлённая цепочка
 */
function propagateFlagsToStage(existingChain, currentFlags, newStage) {
  if (!Array.isArray(currentFlags) || currentFlags.length === 0) {
    return existingChain || [];
  }

  const chain = Array.isArray(existingChain) ? [...existingChain] : [];
  const now = new Date().toISOString();

  for (const flag of currentFlags) {
    if (ALL_VALID_FLAGS.includes(flag)) {
      chain.push({
        flag,
        stage: newStage,
        propagatedAt: now,
      });
    }
  }

  return chain;
}

/**
 * Получить историю прохождения флагов по этапам.
 * 
 * @param {Array} flagChain - цепочка флагов
 * @returns {object} — группировка по этапам
 */
function getFlagPropagationHistory(flagChain) {
  if (!Array.isArray(flagChain) || flagChain.length === 0) {
    return {};
  }

  const history = {};

  for (const entry of flagChain) {
    const { stage } = entry;
    if (!history[stage]) {
      history[stage] = [];
    }
    history[stage].push(entry);
  }

  return history;
}

/**
 * Получить сводку по цепочке флагов.
 * 
 * @param {Array} flagChain - цепочка флагов
 * @returns {object}
 */
function summarizeFlagChain(flagChain) {
  if (!Array.isArray(flagChain) || flagChain.length === 0) {
    return {
      totalPropagations: 0,
      uniqueFlags: [],
      stagesCovered: [],
      startedAt: null,
      lastPropagatedAt: null,
    };
  }

  const uniqueFlags = [...new Set(flagChain.map(e => e.flag))];
  const stagesCovered = [...new Set(flagChain.map(e => e.stage))];
  const timestamps = flagChain.map(e => e.propagatedAt).sort();

  return {
    totalPropagations: flagChain.length,
    uniqueFlags: uniqueFlags.map(f => HANDLING_FLAGS[f]?.label || f),
    stagesCovered,
    startedAt: timestamps[0],
    lastPropagatedAt: timestamps[timestamps.length - 1],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ДИНАМИЧЕСКАЯ ОРКЕСТРАЦИЯ: ПОЛНЫЙ ЦИКЛ
// ═══════════════════════════════════════════════════════════════════════════
//
// orchestrageLifecycleFlags() — главная функция, которая:
//   1. Принимает текущее состояние подарка (флаги, статус, цепочку)
//   2. Проверяет, какие логистические действия нужны
//   3. Обновляет цепочку флагов (propagate)
//   4. Возвращает полный отчёт для текущего этапа
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Оркестрировать флаги транспортировки при переходе на новый этап.
 * 
 * @param {object} params
 * @param {string[]} params.flags - текущие флаги подарка
 * @param {string} params.fromStage - предыдущий этап
 * @param {string} params.toStage - новый этап
 * @param {Array} [params.flagChain] - существующая цепочка флагов (опционально)
 * @param {object} [params.giftInfo] - информация о подарке
 * @returns {object} — полный отчёт оркестрации
 */
function orchestrateLifecycleFlags({ flags, fromStage, toStage, flagChain, giftInfo = {} }) {
  const effectiveFlags = Array.isArray(flags) ? flags : [];

  // 1. Валидируем переход с точки зрения логистики
  const transitionValidation = validateLogisticsTransition(effectiveFlags, fromStage, toStage);

  // 2. "Проталкиваем" флаги на новый этап
  const updatedChain = propagateFlagsToStage(flagChain, effectiveFlags, toStage);

  // 3. Строим контекст для нового этапа
  const lifecycleContext = getFlagsForLifecycleStage(effectiveFlags, toStage);

  // 4. Строим полный манифест
  const manifest = buildLogisticsManifest(effectiveFlags, giftInfo);

  // 5. Сложность доставки
  const complexity = calculateDeliveryComplexity(effectiveFlags);

  // 6. Совместимость флагов
  const compatibility = checkFlagCompatibility(effectiveFlags);

  // 7. Цепочка флагов
  const chainSummary = summarizeFlagChain(updatedChain);

  return {
    // Текущее состояние
    stage: toStage,
    stageInfo: LIFECYCLE_STAGES[toStage] || null,
    lifecycleContext,

    // Флаги
    flags: effectiveFlags,
    flagsAnnotated: annotateFlags(effectiveFlags),

    // Валидация перехода
    transitionValidation,

    // Манифест
    manifest,

    // Сложность
    deliveryComplexity: complexity,

    // Совместимость
    flagCompatibility: compatibility,

    // Цепочка флагов (история прохождения)
    flagChain: updatedChain,
    flagChainSummary: chainSummary,

    // Заметка для доставки
    deliveryNote: buildDeliveryNote(effectiveFlags),

    // Требования к упаковке
    packagingRequirements: getPackagingRequirements(effectiveFlags),

    // Отметка времени
    timestamp: new Date().toISOString(),
  };
}

// ─── Экспорт ─────────────────────────────────────────────────────────────

module.exports = {
  // Константы
  HANDLING_FLAGS,
  ALL_VALID_FLAGS,
  FLAG_CATEGORIES,
  FLAG_COMPATIBILITY,
  LIFECYCLE_STAGES,

  // Валидация
  validateHandlingFlags,
  checkFlagCompatibility,

  // Интроспекция
  getFlagInfo,
  annotateFlags,
  buildDeliveryNote,
  getPackagingRequirements,

  // Логистический манифест
  buildLogisticsManifest,

  // Жизненный цикл
  getFlagsForLifecycleStage,
  calculateDeliveryComplexity,
  getMatchingFlagGroups,

  // ═══ НОВОЕ: Динамическая оркестрация ═══
  validateLogisticsTransition,
  createFlagChain,
  propagateFlagsToStage,
  getFlagPropagationHistory,
  summarizeFlagChain,
  orchestrateLifecycleFlags,
};
