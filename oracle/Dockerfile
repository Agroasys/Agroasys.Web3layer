FROM node

WORKDIR /app

COPY package*.json ./

COPY sdk/package*.json ./sdk/
COPY sdk/tsconfig.json ./sdk/
COPY sdk/src/ ./sdk/src/
RUN cd /app/sdk && npm install && npm run build

COPY notifications/package*.json ./notifications/
COPY notifications/tsconfig.json ./notifications/
COPY notifications/src/ ./notifications/src/
RUN cd /app/notifications && npm install && npm run build

COPY oracle/package*.json ./oracle/
COPY oracle/tsconfig.json ./oracle/

WORKDIR /app/oracle
RUN npm install ../sdk
RUN npm install ../notifications
RUN npm install

COPY oracle/src/ ./src/

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/server.js"]
