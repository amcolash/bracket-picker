# Dependency Stage
FROM mhart/alpine-node:14

# Create app directory
WORKDIR /usr/src/app

# Add testing alpine repo and install dependencies
RUN echo @community http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
  echo http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
  apk add --no-cache exiftool gcc libc-dev libjpeg-turbo-utils vips-tools@community bash

# Grab exifautotran
RUN curl https://raw.githubusercontent.com/freedesktop-unofficial-mirror/libjpeg/master/extra/exifautotran --output /usr/bin/exifautotran && \
  chmod +x /usr/bin/exifautotran

# Grab jpegexiforient
RUN curl https://raw.githubusercontent.com/CiderMan/jpegexiforient/master/jpegexiforient.c --output /tmp/jpegexiforient.c && \
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