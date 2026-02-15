FROM node

WORKDIR /app

COPY package*.json ./
COPY oracle/package*.json ./oracle/
COPY oracle/tsconfig.json ./oracle/

COPY sdk/ ./sdk/

WORKDIR /app/oracle
RUN npm install ../sdk
RUN npm install

COPY oracle/src/ ./src/

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/server.js"]