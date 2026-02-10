import { Logger } from './logger';

export async function retryWithBackoff<T>(operation: () => Promise<T>,operationName: string,maxAttempts: number,baseDelay: number): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            Logger.info(`Attempting ${operationName}`, { attempt, maxAttempts });
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            Logger.warn(`${operationName} failed`, {
                attempt,
                maxAttempts,
                error: error.message,
            });

            if (attempt < maxAttempts) {
                // Exponential backoff: baseDelay * 2^(attempt-1)
                const delay = baseDelay * Math.pow(2, attempt - 1);
                Logger.info(`Retrying after ${delay}ms`, { attempt });
                await sleep(delay);
            }
        }
    }

    Logger.error(`${operationName} failed after ${maxAttempts} attempts`, lastError);
    throw lastError;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}