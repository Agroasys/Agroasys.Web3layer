import { ErrorType, TriggerStatus } from '../types/trigger';
import { Logger } from './logger';


export class OracleError extends Error {
    constructor(
        message: string,
        public errorType: ErrorType,
        public isTerminal: boolean = false
    ) {
        super(message);
        this.name = 'OracleError';
    }
}


export class ValidationError extends OracleError {
    constructor(message: string) {
        super(message, ErrorType.VALIDATION, true);
        this.name = 'ValidationError';
    }
}


export class NetworkError extends OracleError {
    constructor(message: string) {
        super(message, ErrorType.NETWORK, false);
        this.name = 'NetworkError';
    }
}


export class ContractError extends OracleError {
    constructor(message: string, isTerminal: boolean = false) {
        super(message, ErrorType.CONTRACT, isTerminal);
        this.name = 'ContractError';
    }
}


export function classifyError(error: any): OracleError {
    const message = error.message || error.toString();

    Logger.info('Classifying error', { 
        message: message.substring(0, 200) 
    });

    if (error instanceof OracleError) {
        return error;
    }

    if (
        message.includes('Cannot release stage 1') ||
        message.includes('Cannot confirm arrival') ||
        message.includes('Cannot finalize') ||
        message.includes('Invalid trade ID') ||
        message.includes('Dispute window') ||
        message.includes('expected LOCKED') ||
        message.includes('expected IN_TRANSIT') ||
        message.includes('expected ARRIVAL_CONFIRMED')
    ) {
        Logger.warn('Validation error - terminal', { message });
        return new ValidationError(message);
    }

    if (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ETIMEDOUT') ||
        message.includes('ENOTFOUND') ||
        message.includes('fetch failed') ||
        message.includes('connection')
    ) {
        Logger.info('Network error - will retry', { message });
        return new NetworkError(message);
    }

    if (
        message.includes('execution reverted') ||
        message.includes('revert') ||
        message.includes('require')
    ) {
        const isTerminal = 
            message.includes('Invalid state') ||
            message.includes('Not authorized') ||
            message.includes('Trade does not exist') ||
            message.includes('Already executed');

        Logger.warn('Contract error', { isTerminal, message });
        return new ContractError(message, isTerminal);
    }

    Logger.info('Unclassified error - treating as retryable network error');
    return new NetworkError(message);
}

export function determineNextStatus(
    error: OracleError,
    attemptCount: number,
    maxAttempts: number
): TriggerStatus {
    if (error.isTerminal) {
        Logger.warn('Terminal error - no retry', { 
            errorType: error.errorType 
        });
        return TriggerStatus.TERMINAL_FAILURE;
    }

    if (attemptCount >= maxAttempts) {
        Logger.warn('Max attempts reached', { 
            attemptCount, 
            maxAttempts 
        });
        return TriggerStatus.RETRY_EXHAUSTED;
    }

    Logger.info('Error is retryable', { 
        attemptCount, 
        maxAttempts,
        remainingAttempts: maxAttempts - attemptCount
    });
    return TriggerStatus.FAILED;
}