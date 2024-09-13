# Usa la imagen de Zenika con soporte para Puppeteer
FROM zenika/alpine-chrome:with-puppeteer

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Cambia al usuario 'chrome' antes de copiar e instalar
USER chrome

# Copia los archivos package.json y package-lock.json para la instalación de npm
COPY --chown=chrome:chrome package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto de los archivos de la aplicación al contenedor
COPY --chown=chrome:chrome . .

# Construye la aplicación NestJS
RUN npm run build

# Expone los puertos necesarios
EXPOSE 3000

# Establece el comando para ejecutar tu aplicación NestJS en modo producción
CMD ["npm", "run", "start:prod"]
