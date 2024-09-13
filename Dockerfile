FROM node:18

# Evita la descarga de Chromium por Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Instala Google Chrome y las dependencias necesarias
RUN apt-get update \
    && apt-get install -y \
    gconf-service \
    libgbm-dev \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    curl \
    gnupg \
    && curl -sSL https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Crea el directorio de la aplicación
WORKDIR /usr/src/app

# Copia los archivos de configuración de npm
COPY package*.json ./

# Instala las dependencias de la aplicación
RUN npm install

# Copia el código fuente de la aplicación
COPY . .

# Crea una carpeta "dist" con la build de producción
RUN npm run build

# Expone el puerto en el que se ejecutará la aplicación
EXPOSE 3000

# Inicia el servidor usando la build de producción
CMD ["npm", "run", "start:prod"]
