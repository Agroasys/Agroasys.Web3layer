import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware';
import { Logger } from './logger';
import { initializeDatabase } from './database';

async function bootstrap() {
    await initializeDatabase();

    const app = express();

    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        Logger.info(`${req.method} ${req.path}`, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        next();
    });

    app.use('/api/oracle', routes);

    app.use(errorHandler);

    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: 'NotFound',
            message: 'Route not found',
            timestamp: new Date().toISOString(),
        });
    });

    app.listen(config.port, () => {
        Logger.info(`Oracle service started`, {
            port: config.port,
            environment: process.env.NODE_ENV || 'development',
        });
    });
}

bootstrap().catch((error) => {
    Logger.error('Failed to start server', error);
    process.exit(1);
});