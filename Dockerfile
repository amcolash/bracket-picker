# Dependency Stage
FROM mhart/alpine-node:10

# Create app directory
WORKDIR /usr/src/app

# Install deps
RUN apk add exiftool gcc libc-dev libjpeg-turbo-utils

# Grab exifautotran
RUN wget -P /usr/bin/ https://raw.githubusercontent.com/freedesktop-unofficial-mirror/libjpeg/master/extra/exifautotran
RUN chmod +x /usr/bin/exifautotran

# Grab jpegexiforient
RUN wget -P /tmp https://raw.githubusercontent.com/CiderMan/jpegexiforient/master/jpegexiforient.c
RUN gcc /tmp/jpegexiforient.c -o /usr/bin/jpegexiforient

# For caching purposes, install deps without other changed files
COPY package.json package-lock.json ./

# Install deps
RUN npm ci

# Copy only react source code (to keep cache alive if nothing changed here)
COPY ./app/ ./app
COPY index.js ./

# Set things up
EXPOSE 8080