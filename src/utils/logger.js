const DEV = import.meta.env.DEV

const logger = {
  info: (...args) => { if (DEV) console.info('[INFO]', ...args) },
  warn: (...args) => { if (DEV) console.warn('[WARN]', ...args) },
  error: (...args) => { if (DEV) console.error('[ERROR]', ...args) },
}

export default logger
