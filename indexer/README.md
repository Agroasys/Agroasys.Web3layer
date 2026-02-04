# Indexer

Indexer module

##  Local Dev

```bash
npm install

# generate TypeORM models from schema.graphql
npx squid-typeorm-codegen

# start du db container
docker compose up -d db

# generate migrations
rm -rf db/migrations 
npx squid-typeorm-migration generate

# apply the migrations
npx squid-typeorm-migration apply

# compile the code
npm run build

# run the indexer
node -r dotenv/config lib/main.js
```

Edit shema.graphql
```bash
npx squid-typeorm-codegen

rm -rf db/migrations

npx squid-typeorm-migration generate

npx squid-typeorm-migration apply

npm run build
node -r dotenv/config lib/main.js
```

## Indexer in docker container

```bash
npx squid-typeorm-codegen
docker compose up -d db
rm -r db/migrations
npx squid-typeorm-migration generate
docker compose run --rm indexer npx squid-typeorm-migration apply
docker compose up -d
docker compose logs -f
```