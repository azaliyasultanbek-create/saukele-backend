

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



/**
 
 * @param {string[]} flags 
 * @param {object} [giftInfo] 
 * @param {string} [giftInfo.name] 
 * @param {number} [giftInfo.targetAmount] 
 * @param {string} [giftInfo.currency] 
 * @returns {object} 
 */
function buildLogisticsManifest(flags, giftInfo = {}) {
  const annotated = annotateFlags(flags);


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
    
    orchestrationHints: {
      
      packagingFlags: flags.filter(f => HANDLING_FLAGS[f]?.requiresPackaging),
     
      transportFlags: flags.filter(f => HANDLING_FLAGS[f]?.requiresSpecialTransport),
      
      staffingFlags: flags.filter(f => HANDLING_FLAGS[f]?.requiresExtraStaff),
     
      complianceFlags: flags.filter(f => HANDLING_FLAGS[f]?.requiresSignature || HANDLING_FLAGS[f]?.requiresInsurance),
    },
  };
}

/**
 
 * @param {string[]} flags 
 * @param {string} lifecycleStage а
 *        ('pending' | 'funding' | 'funded' | 'purchased' | 'delivered')
 * @returns {object} 
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
 
 * @param {string[]} flags 
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

 * @param {string[]} flags 
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
  
 * @param {string[]} flags - текущие флаги подарка
 * @param {string} fromStage - текущий этап
 * @param {string} toStage - целевой этап
 * @returns {{ canProceed: boolean, warnings: string[], blocks: string[] }}
 */
function validateLogisticsTransition(flags, fromStage, toStage) {
  const warnings = [];
  const blocks = [];

  if (!Array.isArray(flags) || flags.length === 0) {
   
    return { canProceed: true, warnings: [], blocks: [] };
  }

  const annotated = annotateFlags(flags);

  
  if (toStage === 'purchased') {
   
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

   
    if (flags.includes('VALUABLE')) {
      warnings.push('Требуется оформить страховку для ценного груза.');
    }
  }

  
  if (toStage === 'delivered') {
   
    if (flags.some(f => HANDLING_FLAGS[f]?.requiresSpecialTransport)) {
      const transportFlags = flags.filter(f => HANDLING_FLAGS[f]?.requiresSpecialTransport);
      const transportLabels = transportFlags.map(f => HANDLING_FLAGS[f]?.label).filter(Boolean);
      warnings.push(`Требуется спецтранспорт: ${transportLabels.join(', ')}.`);
    }

    
    if (flags.some(f => HANDLING_FLAGS[f]?.requiresExtraStaff)) {
      const staffFlags = flags.filter(f => HANDLING_FLAGS[f]?.requiresExtraStaff);
      const staffLabels = staffFlags.map(f => HANDLING_FLAGS[f]?.label).filter(Boolean);
      warnings.push(`Требуется доп. персонал (грузчики): ${staffLabels.join(', ')}.`);
    }

    
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



/**
 
 * @param {string[]} flags 
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
 
 * @param {Array<{ flag: string, stage: string, propagatedAt: string }>} existingChain 
 * @param {string[]} currentFlags 
 * @param {string} newStage 
 * @returns {Array} 
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
 
 * @param {Array} flagChain 
 * @returns {object} 
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
 
 * @param {Array} flagChain 
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



/**
  
 * @param {object} params
 * @param {string[]} params.flags 
 * @param {string} params.fromStage 
 * @param {string} params.toStage 
 * @param {Array} [params.flagChain] 
 * @param {object} [params.giftInfo] 
 * @returns {object} 
 */
function orchestrateLifecycleFlags({ flags, fromStage, toStage, flagChain, giftInfo = {} }) {
  const effectiveFlags = Array.isArray(flags) ? flags : [];

  
  const transitionValidation = validateLogisticsTransition(effectiveFlags, fromStage, toStage);

 
  const updatedChain = propagateFlagsToStage(flagChain, effectiveFlags, toStage);

  
  const lifecycleContext = getFlagsForLifecycleStage(effectiveFlags, toStage);

  
  const manifest = buildLogisticsManifest(effectiveFlags, giftInfo);

  
  const complexity = calculateDeliveryComplexity(effectiveFlags);

  
  const compatibility = checkFlagCompatibility(effectiveFlags);

 
  const chainSummary = summarizeFlagChain(updatedChain);

  return {
    
    stage: toStage,
    stageInfo: LIFECYCLE_STAGES[toStage] || null,
    lifecycleContext,

    
    flags: effectiveFlags,
    flagsAnnotated: annotateFlags(effectiveFlags),

    
    transitionValidation,

    
    manifest,

    
    deliveryComplexity: complexity,

  
    flagCompatibility: compatibility,

    
    flagChain: updatedChain,
    flagChainSummary: chainSummary,

   
    deliveryNote: buildDeliveryNote(effectiveFlags),

    
    packagingRequirements: getPackagingRequirements(effectiveFlags),


    timestamp: new Date().toISOString(),
  };
}



module.exports = {
  // Константы
  HANDLING_FLAGS,
  ALL_VALID_FLAGS,
  FLAG_CATEGORIES,
  FLAG_COMPATIBILITY,
  LIFECYCLE_STAGES,


  validateHandlingFlags,
  checkFlagCompatibility,

  
  getFlagInfo,
  annotateFlags,
  buildDeliveryNote,
  getPackagingRequirements,


  buildLogisticsManifest,

  
  getFlagsForLifecycleStage,
  calculateDeliveryComplexity,
  getMatchingFlagGroups,

 
  validateLogisticsTransition,
  createFlagChain,
  propagateFlagsToStage,
  getFlagPropagationHistory,
  summarizeFlagChain,
  orchestrateLifecycleFlags,
};
