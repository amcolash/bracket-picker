const { execSync } = require('child_process');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const exiftool = require('node-exiftool');
const ep = new exiftool.ExiftoolProcess();

const tmpDir = '/tmp/bracket-picker/';

const PORT = 9000;
const app = express();

main();

async function main() {
    checkUsage();

    // Get supplied directory
    const dir = process.argv[2];

    extractPreviews(dir);
    const sets = await getMetaData(dir);

    app.listen(PORT);
    console.log(`Running on port ${PORT}`);

    app.use('/', express.static(__dirname + '/app'));
    app.use('/previews', express.static(tmpDir));
    app.get('/data', (req, res) => res.send(sets));
}

function checkUsage() {
    // Check usage
    if (process.argv.length !== 3) {
        console.error("Error: Usage is '" + __filename + " raw_dir'");
        process.exit(1);
    }
}

function extractPreviews(dir) {
    console.log('Cleaning tmp files');
    fs.removeSync(tmpDir);
    fs.mkdirSync(tmpDir);
    
    // Extract images to tmpDir
    console.log('Extracting raw previews');
    runCommand('exiftool -b -previewimage -w ' + tmpDir + '%f.jpg --ext jpg ' + dir);

    // Write tags to extracted images
    console.log('Writing exif data to preview files');
    runCommand('exiftool -tagsfromfile @ -exif:all -srcfile ' + tmpDir + '%f.jpg -overwrite_original --ext jpg ' + dir);

    // Fix orientation of vertical images
    console.log('Auto rotating preview images');
    runCommand('exifautotran ' + tmpDir + '*.jpg');
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

function getMetaData(dir) {
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
        var fileList = [files[i]];
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