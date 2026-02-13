export class Logger {
    private static formatTimestamp(): string {
        return new Date().toISOString();
    }

    static info(message: string, meta?: any): void {
        console.log(JSON.stringify({
            level: 'info',
            timestamp: this.formatTimestamp(),
            message,
            ...meta,
        }));
    }

    static error(message: string, error?: any): void {
        console.error(JSON.stringify({
            level: 'error',
            timestamp: this.formatTimestamp(),
            message,
            error: error?.message || error,
            stack: error?.stack,
        }));
    }

    static warn(message: string, meta?: any): void {
        console.warn(JSON.stringify({
            level: 'warn',
            timestamp: this.formatTimestamp(),
            message,
            ...meta,
        }));
    }

    static audit(action: string, tradeId: string, result: any): void {
        console.log(JSON.stringify({
            level: 'audit',
            timestamp: this.formatTimestamp(),
            action,
            tradeId,
            result,
        }));
    }
}