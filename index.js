const { execSync } = require('child_process');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const nodedir = require('node-dir');

const exiftool = require('node-exiftool');
const ep = new exiftool.ExiftoolProcess();

const baseTmpDir = '/tmp/bracket-picker/';

// Disable vips warnings to avoid lots of logs
process.env.VIPS_WARNING = 'false';

// List of raw extensions from https://en.wikipedia.org/wiki/Raw_image_format
const extensionList = [
    ".3fr", ".ari", ".arw", ".srf", ".sr2", ".bay", ".cri", ".crw", ".cr2", ".cr3", ".cap", ".iiq", ".eip", ".dcs",
    ".dcr", ".drf", ".k25", ".kdc", ".dng", ".erf", ".fff", ".mef", ".mdc", ".mos", ".mrw", ".nef", ".nrw", ".orf",
    ".pef", ".ptx", ".pxn", ".r3d", ".raf", ".raw", ".rw2", ".raw", ".rwl", ".dng", ".rwz", ".srw", ".x3f"
];

var dir;
var tmpDir;
var baseDir;
var sets = {};
var dirs = {};

const PORT = 8080;
const app = express();
app.use(express.json());
app.listen(PORT);

main();

async function main() {
    checkUsage();

    // fs.emptyDirSync(baseTmpDir);
    fs.mkdirpSync(baseTmpDir);

    // Serve an entire dir
    if (process.argv[2] === '-d') {
        const rootDir = resolveDir(process.argv[3]);
        if (!fs.exists(rootDir)) {
            console.error(dir + ' does not exist');
            process.exit(1);
        }
        
        getDirTree(rootDir);
        initServer();
        console.log(`Running on port ${PORT}`);
    } else {
        // Only serving a single directory
        setDir(process.argv[2]);
        initServer();
        console.log(`Running on port ${PORT}`);
    }
}

function checkUsage() {
    // Check usage
    if (process.argv.length < 3 || process.argv.length > 4) {
        console.error("Error: Usage is '" + path.basename(__filename) + " [raw_dir]' or '" + path.basename(__filename) + " -d [root_photo_dir]'");
        process.exit(1);
    }
}

function initServer() {
    // Disable cache since serving multiple pages from the '/' route
    app.get('/', (req, res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.sendFile(__dirname + '/app/' + (tmpDir ? 'index.html' : 'chooser.html'))
    });
    app.use('/', express.static(__dirname + '/app'));

    app.get('/dirs', (req, res) => res.send({ dirs: dirs, baseDir: baseDir }));
    app.get('/data', (req, res) => res.send(sets));
    
    app.post('/move', (req, res) => move(req, res));
    app.post('/undo', (req, res) => undo(req, res));
    app.post('/dir', (req, res) => setDir(req.body.dir, res));
}

function resolveDir(dir) {
    var resolved = path.resolve(dir);
    if (resolved[resolved.length - 1] !== '/') resolved += '/';
    return resolved;
}

async function setDir(newDir, res) {
    dir = resolveDir(newDir);
    console.log('setting base dir to', dir);
    
    if (!fs.existsSync(dir)) {
        console.error(dir + ' does not exist');
        process.exit(1);
    }

    setTmp(path.basename(dir) + '/');

    extractPreviews();
    sets = await getMetadata();

    if (res) res.sendStatus(200);
}

function setTmp(tmp) {
    tmpDir = resolveDir(baseTmpDir + tmp);
    console.log('setting tmp dir to ', tmpDir);

    app.use('/previews', express.static(tmpDir, { maxage: '2h' }));
}

function getDirTree(directory) {
    nodedir.subdirs(directory, function(err, paths) {
        if (err) throw err;
        
        baseDir = path.dirname(directory);

        // make dir tree from based off of: https://stackoverflow.com/a/44681235/2303432
        function insert(children = [], [head, ...tail]) {
            let child = children.find(child => child.name === head);
            if (!child) children.push(child = {name: head, children: []});
            if (tail.length > 0) insert(child.children, tail);
            return children;
        }

        // The below prepends '/', filters dirs, splits by '/' and then makes nested objects
        dirs = paths
            .filter(path => { return !path.match(/\.git|app|node_modules|moved/) })
            .map(path => path.split('/').slice(1))
            .reduce((children, path) => insert(children, path), []);

        function recurse(p, parent) {
            const name = parent + '/' + p.name;

            // Only recurse through paths that actually matter
            const nameCheck = baseDir + (baseDir.length > 1 ? '/' : '') + path.basename(directory);
            if (name.indexOf(nameCheck) !== -1) {
                p.useful = isDirUseful(name);
            } else {
                p.useful = false;
            }
            
            if (p.children) {
                p.children.forEach(child => recurse(child, name));
            }
        }
        
        recurse(dirs[0], '');

        // Run a batch extract of all folders in the root directory
        console.log('Running batch extract on all folders in root directory:', directory);
        console.log('Base Dir is ', baseDir);
        console.log('---------------------------------------------------------------');

        const batchPaths = paths.filter(path => { return !path.match(/\.git|app|node_modules|moved/) });
        batchPaths.push(directory);
        for (var i = 0; i < batchPaths.length; i++) {
            dir = resolveDir(batchPaths[i]);
            tmpDir = resolveDir(baseTmpDir + path.basename(dir));
            extractPreviews();
        }

        console.log('---------------------------------------------------------------');
        console.log('Batch process done');

        // Cleanup
        dir = undefined;
        tmpDir = undefined;
    });
}

function isDirUseful(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (var i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isDirectory()) continue;

        const ext = path.extname(file.name).toLowerCase().trim();
        if (ext.length === 0 || extensionList.filter(s => s.endsWith(ext)).length === 0) continue;

        return true;
    }

    return false;
}

function extractPreviews() {
    var modified = false;

    console.log('Checking files in ' + tmpDir);

    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (var i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isDirectory()) continue;

        const ext = path.extname(file.name).toLowerCase().trim();
        if (ext.length === 0 || extensionList.filter(s => s.includes(ext)).length === 0) continue;

        const fileNoExt = path.basename(file.name, path.extname(file.name));
        const tmpFile = tmpDir + fileNoExt + '.jpg';
        const tmpThumbFile = tmpDir + 'tn_' + fileNoExt + '.jpg';

        try {
            const fileExists = fs.existsSync(tmpFile);
            const thumbExists = fs.existsSync(tmpThumbFile);
            if (!fileExists || !thumbExists) {
                if (!fileExists) console.log(tmpFile + ' does not exist');
                if (!thumbExists) console.log(tmpThumbFile + ' does not exist');
                modified = true;
                break;
            }
        } catch (err) {
            console.error(err);
        }
    }

    if (modified) {
        console.log('Cleaning tmp files');
        fs.emptyDirSync(tmpDir);
        fs.mkdirpSync(tmpDir);

        const escapedDir = dir.replace(/\ /g, '\\\ ');
        const escapedTmp = tmpDir.replace(/\ /g, '\\\ ');
        
        // Extract images to tmpDir
        console.log('Extracting raw previews');
        runCommand('exiftool -b -previewimage -w ' + escapedTmp + '%f.jpg --ext jpg ' + escapedDir);

        const dirFiles = fs.readdirSync(tmpDir, { withFileTypes: true });
        const filtered = dirFiles.filter(path => { return path.isFile() && path.name.indexOf('.jpg') !== -1 });;

        // Only deal with dirs that contain extracted jpeg files
        if (filtered.length > 0) {
            // Write tags to extracted images
            console.log('Writing exif data to preview files');
            runCommand('exiftool -tagsfromfile @ -exif:all -srcfile ' + escapedTmp + '%f.jpg -overwrite_original --ext jpg ' + escapedDir);

            // Fix orientation of vertical images
            console.log('Auto rotating preview images');
            runCommand('exifautotran ' + escapedTmp + '*.jpg');
        
            // Resizing doesn't seem to have an impact on image load but causes long delays on boot
            console.log('Generating thumbnails from full-size previews');
            runCommand('vipsthumbnail ' + escapedTmp + '*.jpg -s 700');
        } else {
            console.log("Didn't find any files in", dir);
        }
    } else {
        console.log('Files up to date in ' + tmpDir + ', not re-extracting');
    }
}

function runCommand(command) {
    try {
        execSync(command, (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                // process.exit(1);
            }
            
            console.log(`${stdout}`);
            console.log(`${stderr}`);
        });
    } catch (err) {
        console.error(err);
    }
}

function getMetadata() {
    console.log('Getting metadata');
    return new Promise(resolve => {
        ep
            .open()
            // read directory
            .then(() => ep.readMetadata(dir, ['-File:all']))
            .then(data => resolve(generateSets(data)), error => { console.error(error); resolve([]); })
            .then(() => console.log('Finished getting metadata'))
            .then(() => ep.close())
            .catch(console.error);
    });
}

function generateSets(data) {
    const sets = {};

    // Filter out non-raw files
    const filtered = data.data.filter(f => {
        const ext = path.extname(f.SourceFile).toLowerCase();
        return extensionList.filter(s => s.includes(ext)).length !== 0;
    });

    // Sort files in ascending order
    const files = filtered.sort((a, b) => {
        var x = a.SourceFile.toLowerCase();
        var y = b.SourceFile.toLowerCase();
        if (x < y) {return -1;}
        if (x > y) {return 1;}
        return 0;
    });

    for (var i = 0; i < files.length; i++) {
        const file = files[i];
        file.FileName = path.basename(file.SourceFile);
        file.PreviewFile = '/previews/' + path.basename(file.SourceFile, path.extname(file.SourceFile)) + '.jpg';
    }

    for (i = 0; i < files.length; i++) {
        var fileList = [files[i]];
        sets[files[i].SourceFile] = fileList;
        
        // reset cycle
        const bracket = getBracket(files[i]);
        if (bracket == 0) {
            const fileNumber = getFileNumber(files[i]);

            var inc = 0;
            if (i + 1 < files.length &&
                ((getFileNumber(files[i + 1]) === (fileNumber + 1) && getBracket(files[i + 1]) < bracket) ||
                (getFileNumber(files[i + 1]) === (fileNumber + 2) && getBracket(files[i + 1]) > bracket)
            )) {
                fileList.push(files[i + 1]);
                inc++;
            }

            if (i + 2 < files.length && files[i + 2].AEBBracketValue != 0 && getFileNumber(files[i + 2]) === (fileNumber + 2)) {
                fileList.push(files[i + 2]);
                inc++;
            }

            i += inc;
        } else {
            const fileNumber = getFileNumber(files[i]);

            if (i + 1 < files.length && getBracket(files[i]) < getBracket(files[i + 1]) && getFileNumber(files[i + 1]) === (fileNumber + 1)) {
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
    fs.mkdirpSync(dest);

    for (var i = 0; i < files.length; i++) {
        const file = files[i];
        const fileDest = dest + path.basename(file);
        console.log('moving', file, 'to', fileDest);

        try {
            fs.moveSync(file, fileDest);
        } catch (err) {
            console.error(err);
        }
    }
    
    sets = await getMetadata();
    res.sendStatus(200);
}

async function undo(req, res) {
    try {
        const files = fs.readdirSync(dir + 'moved/');
        for (var i = 0; i < files.length; i++) {
            const file = dir + 'moved/' + files[i];
            const fileDest = dir + path.basename(files[i]);

            console.log('moving', file, 'to', fileDest);
            fs.moveSync(file, fileDest);
        }
    } catch (err) {
        console.error(err);
    }
    
    extractPreviews();
    sets = await getMetadata();

    res.sendStatus(200);
}