# --- Etapa 1: compilar Angular ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Configuración "development": evita que los límites de tamaño (budgets) de producción detengan la compilación
RUN npx ng build --configuration development

# --- Etapa 2: servir los archivos estáticos con nginx ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/*/browser /usr/share/nginx/html
EXPOSE 80
