# Oracle Signing Service (Node.js)

Files
```
├── docker-compose.yml
├── Dockerfile
├── jest.config.js
├── package.json
├── README.md
├── src
│   ├── api
│   │   ├── controller.ts
│   │   └── routes.ts
│   ├── blockchain
│   │   ├── indexer-client.ts
│   │   └── sdk-client.ts
│   ├── config.ts
│   ├── core
│   │   ├── state-validator.ts
│   │   └── trigger-manager.ts
│   ├── database
│   │   ├── connection.ts
│   │   ├── migrations.ts
│   │   ├── queries.ts
│   │   └── schema.sql
│   ├── middleware
│   │   └── middleware.ts
│   ├── server.ts
│   ├── types
│   │   ├── api.ts
│   │   ├── config.ts
│   │   ├── index.ts
│   │   └── trigger.ts
│   ├── utils
│   │   ├── crypto.ts
│   │   ├── errors.ts
│   │   └── logger.ts
│   └── worker
│       └── confirmation-worker.ts
├── tests
│   └── oracle.test.ts
└── tsconfig.json
```