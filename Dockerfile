# Usa la imagen de Zenika con Puppeteer y Chromium
FROM zenika/alpine-chrome:with-puppeteer

# Establece el directorio de trabajo
WORKDIR /usr/src/app

# Cambia temporalmente al usuario 'root' para instalar pm2
USER root

# Instala PM2 globalmente
RUN npm install -g pm2

# Cambia nuevamente al usuario 'chrome'
USER chrome

# Copia los archivos package.json y package-lock.json
COPY --chown=chrome:chrome package*.json ./

# Configura npm para manejar errores de red e instala dependencias
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm install --verbose

# Copia el resto del código fuente
COPY --chown=chrome:chrome . .

# Verifica que Chromium esté instalado y crea directorios necesarios
RUN echo "Verificando la instalación de Chromium..." \
    && chromium-browser --version \
    && mkdir -p /usr/src/app/dist/sessions \
    && ls -alh /usr/src/app/dist/sessions

# Construye la aplicación NestJS
RUN npm run build

# Exponer el puerto necesario
EXPOSE 3000

# Configura PM2 para ejecutar la aplicación
CMD ["pm2-runtime", "npm", "--", "run", "start:prod"]
