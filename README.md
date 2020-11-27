# bracket-picker

Sift through bracketed raw photos to chose the best ones

Requires `node`, `exiftool`, `libjpg`, `libvips42`. Alternatively you can use `docker`.

Ubuntu one line deps (other than node): `sudo apt install exiftool libjpeg-turbo-progs libvips-tools`

## Getting Started

The easiest ways to get started (I would recommend docker)

```
git clone https://github.com/amcolash/bracket-picker.git
cd bracket-picker
vim docker-compose.yml     <------- Change the mapping from ./test1/ to whatever your base photo dir is
docker-compose up --build
```

Otherwise, install the dependencies and then...

```
git clone https://github.com/amcolash/bracket-picker.git
cd bracket-picker
node index.js -d [YOUR_ROOT_PHOTO_DIR_HERE]
```
