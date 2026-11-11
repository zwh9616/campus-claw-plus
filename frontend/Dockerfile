FROM node@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --prefer-offline --fetch-retries=5 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000 --fetch-timeout=60000
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311
RUN apk add --no-cache --upgrade libxslt=1.1.43-r4
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
ENTRYPOINT []
CMD ["nginx","-g","daemon off;"]
