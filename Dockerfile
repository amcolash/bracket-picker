# Dependency Stage
FROM mhart/alpine-node:10

# Create app directory
WORKDIR /usr/src/app

# Add testing alpine repo and install dependencies
RUN echo @community http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
  apk add --no-cache exiftool gcc libc-dev libjpeg-turbo-utils vips-tools@community bash

# Grab exifautotran
RUN wget -P /usr/bin/ https://raw.githubusercontent.com/freedesktop-unofficial-mirror/libjpeg/master/extra/exifautotran && \
  chmod +x /usr/bin/exifautotran

# Grab jpegexiforient
RUN wget -P /tmp https://raw.githubusercontent.com/CiderMan/jpegexiforient/master/jpegexiforient.c && \
  gcc /tmp/jpegexiforient.c -o /usr/bin/jpegexiforient

# For caching purposes, install deps without other changed files
COPY package.json package-lock.json ./

# Install deps
RUN npm ci

# Copy source code
COPY ./app/ ./app
COPY index.js ./

# Set things up
EXPOSE 8080