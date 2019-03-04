const { execSync } = require('child_process');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const exiftool = require('node-exiftool');
const ep = new exiftool.ExiftoolProcess();

const dir = process.argv[2];
const tmpDir = '/tmp/bracket-picker/' + path.basename(dir) + '/';

const PORT = 9000;
const app = express();
app.use(express.json());

const EXTRACT = false;
var sets = {};

main();

async function main() {
    checkUsage();

    extractPreviews(EXTRACT);
    sets = await getMetaData();

    app.listen(PORT);
    console.log(`Running on port ${PORT}`);

    app.use('/', express.static(__dirname + '/app'));
    app.use('/previews', express.static(tmpDir));
    app.get('/data', (req, res) => res.send(sets));
    app.post('/move', (req, res) => move(req, res));
    app.post('/undo', (req, res) => undo(req, res));
}

function checkUsage() {
    // Check usage
    if (process.argv.length !== 3) {
        console.error("Error: Usage is '" + __filename + " raw_dir'");
        process.exit(1);
    }
}

function extractPreviews(force) {
    var modified = false;

    const files = fs.readdirSync(dir);
    for (var i = 0; i < files.length; i++) {
        const fileNoExt = path.basename(files[i], path.extname(files[i]));
        const file = tmpDir + fileNoExt + '.jpg';
        if (fs.statSync(dir + files[i]).isFile() && !fs.existsSync(file)) {
            console.log(file + ' does not exist');
            modified = true;
            break;
        }
    }

    if (modified || force) {
        console.log('Cleaning tmp files');
        fs.removeSync(tmpDir);
        fs.mkdirpSync(tmpDir);
        
        // Extract images to tmpDir
        console.log('Extracting raw previews');
        runCommand('exiftool -b -previewimage -w ' + tmpDir + '%f.jpg --ext jpg ' + dir);
    
        // Write tags to extracted images
        console.log('Writing exif data to preview files');
        runCommand('exiftool -tagsfromfile @ -exif:all -srcfile ' + tmpDir + '%f.jpg -overwrite_original --ext jpg ' + dir);
    
        // Fix orientation of vertical images
        console.log('Auto rotating preview images');
        runCommand('exifautotran ' + tmpDir + '*.jpg');
    
        // Resizing doesn't seem to have an impact on image load but causes long delays on boot
        // runCommand('vipsthumbnail ' + tmpDir + '*.jpg -s 2000 --rotate');
    } else {
        console.log("Files up to date, not re-extracting");
    }
}

function runCommand(command) {
    execSync(command, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        
        console.log(`${stdout}`);
        console.log(`${stderr}`);
    });
}

function getMetaData() {
    console.log('Getting meta data');
    return new Promise(resolve => {
        ep
            .open()
            // read directory
            .then(() => ep.readMetadata(dir, ['-File:all']))
            .then(data => resolve(generateSets(data)), data => { console.error(data); resolve([]); })
            .then(() => ep.close())
            .catch(console.error);
    });
}

function generateSets(data) {
    const sets = {};

    // Sort files in ascending order
    const files = data.data.sort((a, b) => {
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
        const fileList = [files[i]];
        sets[files[i].SourceFile] = fileList;

        // reset cycle
        if (files[i].BracketValue == 0) {
            
            if (i + 1 < files.length && files[i + 1].BracketValue != 0) {
                fileList.push(files[i + 1]);

                if (i + 2 < files.length && files[i + 2].BracketValue != 0) {
                    fileList.push(files[i + 2]);
                    i++;
                }

                i++;
            }
        }
    }

    return sets;
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
    
    sets = await getMetaData();
    res.sendStatus(200);
}

async function undo(req, res) {
    try {
        const files = fs.readdirSync(dir + 'moved/');
        for (var i = 0; i < files.length; i++) {
            const file = dir + 'moved/' + files[i];
            const fileDest = dir + '/' + path.basename(files[i]);

            console.log('moving', file, 'to', fileDest);
            fs.moveSync(file, fileDest);
        }
    } catch (err) {
        console.error(err);
    }
    
    extractPreviews();
    sets = await getMetaData();

    res.sendStatus(200);
}