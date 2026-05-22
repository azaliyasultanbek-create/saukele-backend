const https = require('https');

const SUPPORTED_CURRENCIES = {
  KZT: { name: 'Казахстанский тенге', symbol: '₸', decimals: 0 },
  EUR: { name: 'Евро', symbol: '€', decimals: 2 },
  USD: { name: 'Доллар США', symbol: '$', decimals: 2 },
};

const BASE_CURRENCY = 'KZT';

const FALLBACK_RATES = {
  KZT: 1,
  EUR: 500,
  USD: 460,
};

const env = require('../config/env');

let cachedRates = { ...FALLBACK_RATES };
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; 
function getSupportedCurrencies() {
  return Object.entries(SUPPORTED_CURRENCIES).map(([code, info]) => ({
    code,
    name: info.name,
    symbol: info.symbol,
    decimals: info.decimals,
  }));
}

function isCurrencySupported(currencyCode) {
  return !!SUPPORTED_CURRENCIES[currencyCode];
}

function fetchRatesFromAPI() {
  return new Promise((resolve, reject) => {
    const url = `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.result === 'success' && parsed.rates) {
            resolve(parsed.rates);
          } else {
            reject(new Error('API response error'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => reject(err));
  });
}

async function refreshRates() {
  const newRates = { ...FALLBACK_RATES };
  if (env.customRates) {
    if (env.customRates.EUR) newRates.EUR = env.customRates.EUR;
    if (env.customRates.USD) newRates.USD = env.customRates.USD;
  }

  if (!env.customRates?.EUR && !env.customRates?.USD) {
    try {
      const apiRates = await fetchRatesFromAPI();
      for (const currency of Object.keys(SUPPORTED_CURRENCIES)) {

  if (currency === BASE_CURRENCY) {
    newRates[currency] = 1;
    continue;
  }

  if (apiRates[currency]) {
    // API возвращает:
    // 1 KZT = X USD

    // Нам нужно:
    // 1 USD = Y KZT

    newRates[currency] = 1 / apiRates[currency];
  }
}
      console.log(` [Currency] Rates updated from API:`, JSON.stringify(newRates));
    } catch (error) {
      console.warn(` [Currency] API unavailable, using fallback rates: ${error.message}`);
    }
  } else {
    console.log(` [Currency] Using custom rates from .env:`, JSON.stringify(newRates));
  }
console.log(cachedRates);
  cachedRates = newRates;
  lastFetchTime = Date.now();
}

/**
 * Получить курс валюты к KZT
 * @param {string} currencyCode - KZT, EUR, USD
 * @returns {number} — сколько KZT в 1 единице валюты
 */
function getRate(currencyCode) {
  if (!isCurrencySupported(currencyCode)) {
    throw new Error(`UNSUPPORTED_CURRENCY: ${currencyCode}`);
  }
  if (currencyCode === BASE_CURRENCY) return 1;
  return cachedRates[currencyCode] || FALLBACK_RATES[currencyCode] || 1;
}

/**
 * Конвертировать сумму из одной валюты в другую
 *
 * @param {number} amount - сумма для конвертации
 * @param {string} fromCurrency - исходная валюта
 * @param {string} toCurrency - целевая валюта
 * @returns {{ amount: number, rate: number }}
 *
 * Пример:
 *   convert(100, 'USD', 'KZT')
 *   => { amount: 46000, rate: 460 }  (1 USD = 460 KZT)
 *
 *   convert(50000, 'KZT', 'USD')
 *   => { amount: 109, rate: 0.0022 } (1 KZT = 0.0022 USD)
 */
function convert(amount, fromCurrency, toCurrency) {
  if (!isCurrencySupported(fromCurrency)) {
    throw new Error(`UNSUPPORTED_CURRENCY: ${fromCurrency}`);
  }
  if (!isCurrencySupported(toCurrency)) {
    throw new Error(`UNSUPPORTED_CURRENCY: ${toCurrency}`);
  }
  
  if (fromCurrency === toCurrency) {
    return { amount: Math.round(amount), rate: 1 };
  }
  
  
  const fromRate = getRate(fromCurrency);   
  const toRate = getRate(toCurrency);       
  const inKZT = amount * fromRate;
  const converted = inKZT / toRate;
  const crossRate = fromRate / toRate;

  return {
    amount: Math.round(converted),
    rate: Math.round(crossRate * 10000) / 10000,
  };
}

/**
 * Форматировать сумму с символом валюты
 * @param {number} amount
 * @param {string} currencyCode
 * @returns {string} — "₸ 50000", "$ 108.70", "€ 94.34"
 */
function formatAmount(amount, currencyCode) {
  const info = SUPPORTED_CURRENCIES[currencyCode];

  if (!info) return `${amount} ${currencyCode}`;

  const formatted = info.decimals > 0
    ? (amount / (10 ** (2 - info.decimals))).toFixed(info.decimals)
    : amount.toString();

  return `${info.symbol} ${formatted}`;
}


if (process.env.NODE_ENV !== 'test') {
  refreshRates();
}

const refreshInterval = setInterval(refreshRates, 60 * 60 * 1000);
if (refreshInterval.unref) {
  refreshInterval.unref();
}

/**
 * Заморозить (заблокировать) курс обмена в момент транзакции.
 * Возвращает "snapshot" курса между двумя валютами с меткой времени.
 *
 * Этот snapshot должен быть записан в строку транзакции (Contribution)
 * и НЕ должен изменяться после записи (иммутабельность).
 *
 * @param {string} fromCurrency - исходная валюта (в которой платит гость)
 * @param {string} toCurrency   - целевая валюта (валюта подарка)
 * @param {number} [amount]     - опциональная сумма для конвертации
 * @returns {{ rate: number, rateTimestamp: string, fromCurrency: string, toCurrency: string, convertedAmount: number|null }}
 *
 * Пример:
 *   snapshotRate('USD', 'KZT', 100)
 *   => {
 *        rate: 460,
 *        rateTimestamp: '2025-06-21T17:28:44.123Z',
 *        fromCurrency: 'USD',
 *        toCurrency: 'KZT',
 *        convertedAmount: 46000
 *      }
 */
function snapshotRate(fromCurrency, toCurrency, amount = null) {
  if (!isCurrencySupported(fromCurrency)) {
    throw new Error(`UNSUPPORTED_CURRENCY: ${fromCurrency}`);
  }

  if (!isCurrencySupported(toCurrency)) {
    throw new Error(`UNSUPPORTED_CURRENCY: ${toCurrency}`);
  }

  const conversion = convert(
    amount || 1,
    fromCurrency,
    toCurrency
  );

  return {
    rate: conversion.rate,
    rateTimestamp: new Date().toISOString(),
    fromCurrency,
    toCurrency,
    convertedAmount:
      amount !== null
        ? conversion.amount
        : null,
  };
}