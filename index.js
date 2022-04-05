const { exec } = require('child_process');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const nodedir = require('node-dir');

const baseTmpDir = (fs.existsSync('/tmp-ext') ? '/tmp-ext' : '/tmp') + '/bracket-picker/';
console.log(`Using tmp dir: ${baseTmpDir}`);

// Disable vips warnings to avoid lots of logs
process.env.VIPS_WARNING = 'false';

// List of raw extensions from https://en.wikipedia.org/wiki/Raw_image_format
const extensionList = [
  '.3fr',
  '.ari',
  '.arw',
  '.srf',
  '.sr2',
  '.bay',
  '.cri',
  '.crw',
  '.cr2',
  '.cr3',
  '.cap',
  '.iiq',
  '.eip',
  '.dcs',
  '.dcr',
  '.drf',
  '.k25',
  '.kdc',
  '.dng',
  '.erf',
  '.fff',
  '.mef',
  '.mdc',
  '.mos',
  '.mrw',
  '.nef',
  '.nrw',
  '.orf',
  '.pef',
  '.ptx',
  '.pxn',
  '.r3d',
  '.raf',
  '.raw',
  '.rw2',
  '.raw',
  '.rwl',
  '.dng',
  '.rwz',
  '.srw',
  '.x3f',
];

var dir;
var tmpDir;
var baseDir;
var rootDir;
var sets = {};
var dirs = {};
var singleDir = false;
var movedEmpty = true;
var state = { text: 'Initializing', progress: '' };

const PORT = 8080;
const app = express();
app.use(express.json());
app.listen(PORT);

main();

async function main() {
  checkUsage();

  // console.log('WIPING TMP DIR!');
  // await fs.emptyDir(baseTmpDir);

  await fs.mkdirp(baseTmpDir);

  // Start server
  initServer();
  console.log(`Running on port ${PORT}`);

  // Serve an entire dir
  checkUsage();

  rootDir = resolveDir(process.argv[2]);
  try {
    // Make sure the directory is valid
    await fs.stat(rootDir);

    // Look through directories
    getDirTree(rootDir);
  } catch (e) {
    console.error('Error: ' + rootDir + ' does not exist');
    process.exit(1);
  }
}

function checkUsage() {
  if (process.argv.length !== 3) {
    console.error("Error: Usage is '" + path.basename(__filename) + " photo_dir'");
    process.exit(1);
  }
}

function initServer() {
  // Disable cache since serving multiple pages from the '/' route
  app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.sendFile(__dirname + '/app/' + (state.text === 'Complete' ? (tmpDir ? 'index.html' : 'chooser.html') : 'loading.html'));
  });
  app.use('/', express.static(__dirname + '/app'));

  app.get('/dir', (req, res) => res.send({ dir, tmpDir, relative: path.relative(baseDir || '', dir || '') }));
  app.get('/dirs', (req, res) => res.send({ dirs, baseDir, singleDir }));
  app.get('/data', (req, res) => res.send({ sets, movedEmpty }));
  app.get('/state', (req, res) => res.send(state));

  app.post('/move', (req, res) => move(req, res));
  app.post('/undo', (req, res) => undo(req, res));
  app.post('/dir', (req, res) => setDir(req.body.dir, res));
  app.post('/refresh', (req, res) => {
    res.sendStatus(200);
    getDirTree(rootDir);
  });
}

function resolveDir(dir) {
  var resolved = path.resolve(dir);
  if (resolved[resolved.length - 1] !== '/') resolved += '/';
  return resolved;
}

async function setDir(newDir, res) {
  dir = resolveDir(newDir);
  console.log('Setting base dir to', dir);
  updateTmp();

  if (await !fs.exists(dir)) {
    console.error(dir + ' does not exist');
    if (res) res.sendStatus(404);
    return;
  }

  setState('Running batch extraction', '');
  if (res) res.sendStatus(200);

  extractPreviews();
  sets = await getMetadata(false);

  setState('Complete');
}

function updateTmp() {
  const tmp = path.relative(rootDir, dir);

  tmpDir = resolveDir(baseTmpDir + tmp);
  fs.mkdirpSync(tmpDir);

  console.log('Setting tmp dir to ', tmpDir);

  app.use('/previews', express.static(tmpDir, { maxage: '2w' }));
}

async function getDirTree(directory) {
  setState('Getting directory tree');
  nodedir.subdirs(directory, async function (err, paths) {
    if (err) throw err;

    baseDir = path.dirname(directory);

    // make dir tree from based off of: https://stackoverflow.com/a/44681235/2303432
    function insert(children = [], [head, ...tail]) {
      let child = children.find((child) => child.name === head);
      if (!child && head) children.push((child = { name: head, children: [] }));
      if (tail.length > 0) insert(child.children, tail);
      return children;
    }

    // Make sure the base directory is included
    paths.push(directory);

    // The below prepends '/', filters dirs, splits by '/' and then makes nested objects
    dirs = paths
      .filter((path) => {
        return !path.match(/\.git|app|node_modules|moved/);
      })
      .map((path) => path.split('/').slice(1))
      .reduce((children, path) => insert(children, path), []);

    async function recurse(p, parent) {
      const name = parent + '/' + p.name;

      // Only recurse through paths that actually matter
      const nameCheck = baseDir + (baseDir.length > 1 ? '/' : '') + path.basename(directory);
      if (name.indexOf(nameCheck) !== -1) {
        p.useful = await isDirUseful(name);
      } else {
        p.useful = false;
      }

      if (p.children) {
        p.children.forEach(async (child) => {
          await recurse(child, name);
        });
      }
    }

    await recurse(dirs[0], '');

    // Run a batch extract of all folders in the root directory
    console.log('Running batch extract on all folders in root directory:', directory);
    console.log('Base Dir is ', baseDir);
    console.log('---------------------------------------------------------------');

    const batchPaths = await filterAsync(paths, async (path) => {
      const useful = await isDirUseful(path);
      const matches = path.match(/\.git|app|node_modules|moved/);

      return useful && !matches;
    });

    for (var i = 0; i < batchPaths.length; i++) {
      setState('Running batch extraction', i + 1 + ' / ' + batchPaths.length);

      dir = resolveDir(batchPaths[i]);
      updateTmp();

      await extractPreviews();
    }

    console.log('---------------------------------------------------------------');
    console.log('Batch process done');

    if (batchPaths.length === 1) {
      // If there is only a single directory, set it up here
      dir = directory;
      updateTmp();
      sets = await getMetadata(false);

      singleDir = true;
    } else {
      // Cleanup
      dir = undefined;
      tmpDir = undefined;
      singleDir = false;
    }

    setState('Complete');
  });
}

// Async filter code from https://stackoverflow.com/a/46842181/2303432
async function filterAsync(arr, callback) {
  const fail = Symbol();
  return (await Promise.all(arr.map(async (item) => ((await callback(item)) ? item : fail)))).filter((i) => i !== fail);
}

async function isDirUseful(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });

  for (var i = 0; i < files.length; i++) {
    const file = files[i];
    // if (file.isDirectory()) continue;

    const ext = path.extname(file.name).toLowerCase().trim();
    if (ext.length === 0 || extensionList.filter((s) => s.endsWith(ext)).length === 0) continue;

    return true;
  }

  return false;
}

async function existHelper(file) {
  try {
    const s = await fs.stat(file);
    return true;
  } catch (err) {
    return false;
  }
}

async function extractPreviews() {
  var modified = false;

  console.log('Checking files in ' + tmpDir);

  const files = await fs.readdir(dir, { withFileTypes: true });
  for (var i = 0; i < files.length; i++) {
    const file = files[i];
    // if (file.isDirectory()) continue;

    const ext = path.extname(file.name).toLowerCase().trim();
    if (ext.length === 0 || extensionList.filter((s) => s.includes(ext)).length === 0) continue;

    const fileNoExt = path.basename(file.name, path.extname(file.name));
    const tmpFile = tmpDir + fileNoExt + '.jpg';
    const tmpThumbFile = tmpDir + 'tn_' + fileNoExt + '.jpg';
    const tmpLargeThumbFile = tmpDir + 'tn_lg_' + fileNoExt + '.jpg';

    try {
      const fileExists = await existHelper(tmpFile);
      const thumbExists = await existHelper(tmpThumbFile);
      const largeThumbExists = await existHelper(tmpLargeThumbFile);
      if (!fileExists || !thumbExists || !largeThumbExists) {
        if (!fileExists) console.log(tmpFile + ' does not exist');
        if (!thumbExists) console.log(tmpThumbFile + ' does not exist');
        if (!largeThumbExists) console.log(tmpLargeThumbFile + ' does not exist');
        modified = true;
        break;
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (modified) {
    console.log('Cleaning tmp files');
    await fs.emptyDir(tmpDir);
    await fs.mkdirp(tmpDir);

    const escapedDir = dir.replace(/\ /g, '\\ ');
    const escapedTmp = tmpDir.replace(/\ /g, '\\ ');

    // Extract images to tmpDir

    setState('Extracting raw previews');
    await runCommand(`exiftool -b -previewimage -w ${escapedTmp}%f.jpg --ext jpg ${escapedDir}`);

    console.log('Checking tmp dir');
    const dirFiles = await fs.readdir(tmpDir, { withFileTypes: true });
    const filtered = dirFiles.filter((path) => {
      return path.isFile() && path.name.indexOf('.jpg') !== -1;
    });

    // Only deal with dirs that contain extracted jpeg files
    if (filtered.length > 0) {
      // Extract exif tags from source files to tmpDir
      setState('Extracting exif data from files');

      // More reliable than piping for some reason?
      const data = await runCommand('exiftool -json ' + escapedDir);
      const tagFile = path.join(escapedTmp + '/tags.json');
      fs.writeFileSync(tagFile, data);

      // Write tags to extracted images
      setState('Writing exif data to preview files');
      await runCommand(`exiftool -tagsfromfile @ -exif:all -srcfile ${escapedTmp}%f.jpg -overwrite_original --ext jpg ${escapedDir}`);

      // Fix orientation of vertical images
      setState('Auto rotating preview images');
      await runCommand(`exifautotran ${escapedTmp}*.jpg`);

      // Make large images first
      setState('Generating large thumbnails from full-size previews');
      await runCommand(`vipsthumbnail ${escapedTmp}*.jpg -s 2000 -o tn_lg_%s.jpg`);

      // Resizing from already smaller images to tiny thumbnails is much faster
      setState('Generating small thumbnails from large thumbnails');
      await runCommand(`vipsthumbnail ${escapedTmp}tn_lg_*.jpg -s 700`);

      // Fix double named things (since it is easiest this way)
      setState('Fixing thumbnail names');
      await runCommand(`for file in ${escapedTmp}tn_tn_lg_*.jpg; do mv "$file" "\${file/tn_lg_/}";done;`);
    } else {
      console.log(`Didn't find any files in ${dir}`);
    }
  } else {
    console.log(`Files up to date in ${tmpDir}, not re-extracting`);
  }
}

function setState(text, progress) {
  state.text = text;
  if (progress !== undefined) state.progress = progress;

  console.log(text, progress || '');
}

async function runCommand(command) {
  // console.log(`$ ${command}`);
  try {
    const c = await awaitExec(command);

    // console.log(`${c.stdout.trim()}`);
    // console.log(`${c.stderr.trim()}`);

    return c.stdout.trim();
  } catch (err) {
    console.error(err);
  }
}

// Code from: https://github.com/hanford/await-exec
function awaitExec(command, options = { log: false, cwd: process.cwd(), shell: '/bin/bash' }) {
  if (options.log) console.log(command);

  return new Promise((done, failed) => {
    exec(command, { ...options }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        failed(err);
        return;
      }

      done({ stdout, stderr });
    });
  });
}

function getMetadata(forced) {
  setState('Getting Metadata');
  return new Promise(async (resolve) => {
    try {
      await fs.readdir(dir + '/moved', (err, files) => {
        movedEmpty = !files || files.length === 0;
      });

      const escapedDir = dir.replace(/\ /g, '\\ ');
      const escapedTmp = tmpDir.replace(/\ /g, '\\ ');
      const tagFile = path.join(escapedTmp + '/tags.json');

      const tagsExist = await fs.exists(tagFile);

      if (forced || !tagsExist) {
        // More reliable than piping for some reason?
        const data = await runCommand('exiftool -json ' + escapedDir);
        fs.writeFileSync(tagFile, data);
      }

      fs.readFile(tagFile, (err, data) => {
        if (err) {
          console.error(err);
          resolve({});
        } else {
          try {
            resolve(generateSets(JSON.parse(data)));
          } catch (err) {
            console.error(err);
            resolve({});
          }
        }
      });
    } catch (e) {
      console.error(e);
      resolve({});
    }
  });
}

function generateSets(data) {
  const sets = {};

  // Filter out non-raw files
  const filtered = data.filter((f) => {
    const ext = path.extname(f.SourceFile).toLowerCase();
    return extensionList.filter((s) => s.includes(ext)).length !== 0;
  });

  // Sort files in ascending order
  const files = filtered.sort((a, b) => {
    var x = a.SourceFile.toLowerCase();
    var y = b.SourceFile.toLowerCase();
    if (x < y) {
      return -1;
    }
    if (x > y) {
      return 1;
    }
    return 0;
  });

  for (var i = 0; i < files.length; i++) {
    const file = files[i];
    const strippedFile = {
      SourceFile: file.SourceFile,
      FileName: path.basename(file.SourceFile),
      DateTime: file.DateTimeOriginal,
      LargeFile: '/previews/' + path.basename(file.SourceFile, path.extname(file.SourceFile)) + '.jpg',
      PreviewFile: '/previews/tn_lg_' + path.basename(file.SourceFile, path.extname(file.SourceFile)) + '.jpg',
      ThumbnailFile: '/previews/tn_' + path.basename(file.SourceFile, path.extname(file.SourceFile)) + '.jpg',
      FileName: file.FileName,
      Aperture: file.Aperture,
      ISO: file.ISO,
      ShutterSpeed: file.ShutterSpeed,
      FocalLength: file.FocalLength,
      AEBBracketValue: file.AEBBracketValue,
    };

    // Strip down file data so only values used are passed over the wire (about 3% of total data)
    files[i] = strippedFile;
  }

  for (i = 0; i < files.length; i++) {
    var fileList = [files[i]];
    sets[files[i].SourceFile] = fileList;

    // reset cycle
    const bracket = getBracket(files[i]);
    if (bracket == 0) {
      const fileNumber = getFileNumber(files[i]);

      var inc = 0;
      if (
        i + 1 < files.length &&
        ((getFileNumber(files[i + 1]) === fileNumber + 1 && getBracket(files[i + 1]) < bracket) ||
          (getFileNumber(files[i + 1]) === fileNumber + 2 && getBracket(files[i + 1]) > bracket))
      ) {
        fileList.push(files[i + 1]);
        inc++;
      }

      if (i + 2 < files.length && files[i + 2].AEBBracketValue != 0 && getFileNumber(files[i + 2]) === fileNumber + 2) {
        fileList.push(files[i + 2]);
        inc++;
      }

      i += inc;
    } else {
      const fileNumber = getFileNumber(files[i]);

      if (i + 1 < files.length && getBracket(files[i]) < getBracket(files[i + 1]) && getFileNumber(files[i + 1]) === fileNumber + 1) {
        fileList.push(files[i + 1]);
        i++;
      }
    }

    fileList = fileList.sort((a, b) => {
      var x = eval(a.AEBBracketValue);
      var y = eval(b.AEBBracketValue);
      return Math.sign(x - y);
    });
  }

  return sets;
}

function getBracket(file) {
  return eval(file.AEBBracketValue);
}

function getFileNumber(file) {
  return Number.parseInt(path.basename(file.SourceFile, path.extname(file.SourceFile)).replace(/\D+/g, ''));
}

async function move(req, res) {
  const files = req.body.files;

  const dest = dir + 'moved/';
  await fs.mkdirp(dest);

  for (var i = 0; i < files.length; i++) {
    const file = path.normalize(files[i]);
    const fileDest = dest + path.basename(file);
    console.log('moving', file, 'to', fileDest);

    try {
      await fs.move(file, fileDest);
    } catch (err) {
      console.error(err);
    }
  }

  // Extract new metadata on move
  setState('Extracting exif data from files');
  sets = await getMetadata(true);

  setState('Complete');
  res.sendStatus(200);
}

async function undo(req, res) {
  try {
    const files = await fs.readdir(dir + 'moved/');
    for (var i = 0; i < files.length; i++) {
      const file = dir + 'moved/' + files[i];
      const fileDest = dir + path.basename(files[i]);

      console.log('moving', file, 'to', fileDest);
      await fs.move(file, fileDest);
    }
  } catch (err) {
    console.error(err);
  }

  extractPreviews();
  sets = await getMetadata(true);

  setState('Complete');
  res.sendStatus(200);
}
