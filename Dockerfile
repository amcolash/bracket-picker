# Dependency Stage
FROM mhart/alpine-node:14

# Create app directory
WORKDIR /usr/src/app

# Add most dependencies
RUN apk add --no-cache exiftool gcc libc-dev libjpeg-turbo-utils bash curl

# Add libvips from community repo (using the 3.14 alpine tagged version since edge seems to be broken)
RUN apk add --update --no-cache --repository http://dl-3.alpinelinux.org/alpine/v3.14/community --repository http://dl-3.alpinelinux.org/alpine/v3.14/main vips-tools

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
