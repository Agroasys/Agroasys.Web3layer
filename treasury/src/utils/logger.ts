interface LogMeta {
  [key: string]: unknown;
}

export class Logger {
  private static write(level: 'info' | 'warn' | 'error', message: string, meta?: LogMeta): void {
    const payload = {
      level,
      timestamp: new Date().toISOString(),
      message,
      ...meta,
    };

    if (level === 'error') {
      console.error(JSON.stringify(payload));
      return;
    }

    if (level === 'warn') {
      console.warn(JSON.stringify(payload));
      return;
    }

    console.log(JSON.stringify(payload));
  }

  static info(message: string, meta?: LogMeta): void {
    this.write('info', message, meta);
  }

  static warn(message: string, meta?: LogMeta): void {
    this.write('warn', message, meta);
  }

  static error(message: string, meta?: LogMeta): void {
    this.write('error', message, meta);
  }
}
