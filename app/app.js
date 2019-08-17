var setIndex = 0;
var previewIndex = 0;
var sets = [];
var setsLength = 0;
var totalSize = 0;
var selected = {};
var currentSet = [];
var lastKey; 

// TODO: Select All (Either when selecting, or a button)
// That makes it easier to then remove only the ones that should stay

const mod = (x, n) => (x % n + n) % n;

window.onload = () => {
    axios.get('/dir').then(response => {
        if (!response.data.dir) {
          window.location.pathname = '/';
        } else {
            folder.innerText = response.data.relative;
        }
    });

    axios.get('/dirs').then(response => {
        if (!response.data.singleDir) {
            dirs.style.display = 'block';
        }
    });

    feather.replace();
    
    // Disable context menu on touch, but keep for mouse right click
    window.oncontextmenu = (event) => {
        if (event.sourceCapabilities.firesTouchEvents) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
   };

    back.addEventListener('click', () => update(mod(setIndex - 1, setsLength)));
    forward.addEventListener('click', () => update(mod(setIndex + 1, setsLength)));
    backLarge.addEventListener('click', () => update(mod(setIndex - 5, setsLength)));
    forwardLarge.addEventListener('click', () => update(mod(setIndex + 5, setsLength)));
    
    // reset.addEventListener('click', () => update(0));
    move.addEventListener('click', moveFiles);
    undo.addEventListener('click', undoMove);
    fullscreen.addEventListener('click', toggleFullscreen);
    
    image1.addEventListener('click', () => select(0));
    image2.addEventListener('click', () => select(1));
    image3.addEventListener('click', () => select(2));
    
    previewImg.addEventListener('click', e => { e.stopPropagation(); select(previewIndex) });

    preview1.addEventListener('click', () => preview(0));
    preview2.addEventListener('click', () => preview(1));
    preview3.addEventListener('click', () => preview(2));

    pager1.addEventListener('click', e => { e.stopPropagation(); preview(0); });
    pager2.addEventListener('click', e => { e.stopPropagation(); preview(1); });
    pager3.addEventListener('click', e => { e.stopPropagation(); preview(2); });

    leftArrow.addEventListener('click', e => { e.stopPropagation(); preview(previewIndex - 1); });
    rightArrow.addEventListener('click', e => { e.stopPropagation(); preview(previewIndex + 1); });

    overlay.addEventListener('click', e => { hideOverlay(); });
    info.addEventListener('click', e => { toggleInfo(); e.stopPropagation(); });
    download.addEventListener('click', e => e.stopPropagation());
    large.addEventListener('click', e => e.stopPropagation());

    image1.addEventListener('load', () => { file1.innerHTML = getInfo(currentSet[0], image1, histogram1);
        section1.classList.remove('hidden'); feather.replace(); });
    image2.addEventListener('load', () => { file2.innerHTML = getInfo(currentSet[1], image2, histogram2);
        section2.classList.remove('hidden'); feather.replace(); });
    image3.addEventListener('load', () => { file3.innerHTML = getInfo(currentSet[2], image3, histogram3);
        section3.classList.remove('hidden'); feather.replace(); });
    
    // Still draw histogram based off of thumbnail - might need to think this through if it uses old thumb...
    previewImg.addEventListener('load', () => {
        var img = image1;
        if (previewIndex === 1) img = image2;
        if (previewIndex === 2) img = image3;

        overlayFile.innerHTML = getInfo(currentSet[previewIndex], img, previewHistogram);
        feather.replace();
    });
    
    window.onkeydown = checkKey;
    window.onkeyup = () => lastKey = null;

    const pinchOut = { recognizers: [[ Hammer.Pinch, { enable: true, threshold: 1.25 } ]] };
    const pinchIn = { recognizers: [[ Hammer.Pinch, { enable: true, threshold: 0.5 } ]] };
    const press = { recognizers: [[ Hammer.Press, { time: 500 }]]};

    new Hammer(images).on('swipeleft', () => forward.click());
    new Hammer(images).on('swiperight', () => back.click());

    new Hammer(overlay).on('swipeleft', () => preview(previewIndex + 1));
    new Hammer(overlay, { recognizers: [[Hammer.Swipe, { pointers: 2 }]]}).on('swipeleft', () => forward.click());

    new Hammer(overlay).on('swiperight', () => preview(previewIndex - 1));
    new Hammer(overlay, { recognizers: [[Hammer.Swipe, { pointers: 2 }]]}).on('swiperight', () => back.click());

    new Hammer(image1, pinchOut).on('pinchout', () => preview(0));
    new Hammer(image2, pinchOut).on('pinchout', () => preview(1));
    new Hammer(image3, pinchOut).on('pinchout', () => preview(2));
    new Hammer(image1, press).on('press', () => preview(0));
    new Hammer(image2, press).on('press', () => preview(1));
    new Hammer(image3, press).on('press', () => preview(2));

    new Hammer(overlay, press).on('press', () => hideOverlay());
    new Hammer(overlay, pinchIn).on('pinchin', () => hideOverlay());
    
    joypad.on('button_press', e => {
        const button = e.detail.index;

        if (button === 3) { // Y
            if (!overlayShown() && !e.detail.gamepad.buttons[8].pressed) select(0); // Y + Select not pressed
            else preview(0);
        }

        if (button === 0) { // X
            if (!overlayShown() && !e.detail.gamepad.buttons[8].pressed) select(1); // Y + Select not pressed
            else preview(1);
        }

        if (button === 1) { // A
            if (!overlayShown() && !e.detail.gamepad.buttons[8].pressed) select(2); // Y + Select not pressed
            else preview(2);
        }

        if (button === 2 && overlayShown()) select(previewIndex); // B

        if (button === 4) { // L1
            if (overlayShown()) preview(previewIndex - 1);
            else back.click();
        }

        if (button === 5) { // R1
            if (overlayShown()) preview(previewIndex + 1);
            else forward.click();
        }

        if (button === 8) { // Select
            if (overlayShown()) {
                toggleInfo();
            }
        }

        if (button === 9) { // Start
            if (e.detail.gamepad.buttons[8].pressed) toggleFullscreen(); // Start + Select
            else if (overlayShown()) hideOverlay();
            else preview(0);
        }

        console.log(e)
    });

    // Helper so that events only happen on axis state change
    function resetJoystick(axis, cb) {
        setTimeout(() => {
            if (joypad.instances[0]) {
                const joy = joypad.instances[0];
                const a = joy.axes[axis];
                if (a !== previousAxis[axis]) {
                    previousAxis[axis] = a;
                    if (cb) cb();
                } else {
                    resetJoystick(axis, cb);
                }
            } else {
                console.error("couldn't find controller");
                previousAxis[axis] = 0;
            }
        }, 100);
    }
    
    // Use some magic to only react to state changes in axis by comparing previous values
    let previousAxis = [0, 0];
    joypad.on('axis_move', e => {
        const axis = e.detail.axis;
        const value = e.detail.axisMovementValue;
        
        if (previousAxis[axis] !== value) {
            if (axis === 0 && value === -1) {
                if (overlayShown()) {
                    preview(previewIndex - 1);
                } else {
                    back.click();
                }
            }
            if (axis === 0 && value === 1) {
                if (overlayShown()) {
                    preview(previewIndex + 1);
                } else {
                    forward.click();
                }
            }
            if (axis === 1 && value === -1) backLarge.click();
            if (axis === 1 && value === 1) forwardLarge.click();

            resetJoystick(axis);
        }

        previousAxis[axis] = value;
    });

    getData();
}

function checkKey(e) {
    e = e || window.event;

    if (e.keyCode === lastKey) return;
    lastKey = e.keyCode;

    // Call click function to use the same logic as the buttons
    if (e.keyCode == '13' && e.ctrlKey) { // Enter + Ctrl
        moveFiles();
    } else if (e.keyCode == '37' && e.ctrlKey) { // Left Arrow + Ctrl
        if (overlayShown()) {
            back.click();
        } else {
            backLarge.click();
        }
    } else if (e.keyCode == '37') { // Left Arrow
        if (overlayShown()) {
            preview(previewIndex - 1);
        } else {
            back.click();
        }
    } else if (e.keyCode == '39' && e.ctrlKey) { // Right Arrow + Ctrl
        if (overlayShown()) {
            forward.click();
        } else {
            forwardLarge.click();
        }
    } else if (e.keyCode == '39') { // Right Arrow
        if (overlayShown()) {
            preview(previewIndex + 1);
        } else {
            forward.click();
        }
    } else if (e.keyCode == '49') { // 1
        if (!overlayShown()) select(0);
    } else if (e.keyCode == '50') { // 2
        if (!overlayShown()) select(1);
    } else if (e.keyCode == '51') { // 3
        if (!overlayShown()) select(2);
    } else if (e.keyCode == '65') { // a
        selectAll();
    } else if (e.keyCode == '83') { // s
        selectNone();
    } else if (e.keyCode == '27') { // esc
        hideOverlay();
    } else if ((e.keyCode == '32' || e.keyCode == '82') && !e.ctrlKey) { // space, r
        if (overlayShown()) {
            select(previewIndex);
        } else {
            select(0);
        }
    } else if (e.keyCode == '81') { // q
        if (overlayShown() && previewIndex === 0) {
            hideOverlay();
        } else {
            preview(0);
        }
    } else if (e.keyCode == '87') { // w
        if (overlayShown() && previewIndex === 1) {
            hideOverlay();
        } else {
            preview(1);
        }
    } else if (e.keyCode == '69') { // e
        if (overlayShown() && previewIndex === 2) {
            hideOverlay();
        } else {
            preview(2);
        }
    } else if (e.keyCode == '90') { // z
        if (overlayShown()) {
            hideOverlay();
        } else {
            preview(0);
        }
    } else if (e.keyCode == '88') { // x
        toggleInfo();
    } else if (e.keyCode == '191') { // '/'
        forward.click();
    } else if (e.keyCode == '190') { // '.'
        back.click();
    }
}

function getData() {
    window.onbeforeunload = null;
    axios.get('/data').then(data => {
        sets = data.data.sets;

        const keys = Object.keys(sets);
        setsLength = keys.length;
        
        totalSize = 0;
        for (var i = 0; i < keys.length; i++) {
            totalSize += sets[keys[i]].length;
        }

        undo.disabled = data.data.movedEmpty;

        update(mod(setIndex, setsLength));
    }).catch((err) => {
        console.error(err);
    });
}

function showOverlay() {
    overlay.classList.add('shown');
    file1.parentElement.classList.add('invisible');
    file2.parentElement.classList.add('invisible');
    file3.parentElement.classList.add('invisible');
    controls.classList.add('invisible');
    chooser.classList.add('invisible');
}

function hideOverlay() {
    overlay.classList.remove('shown');
    file1.parentElement.classList.remove('invisible');
    file2.parentElement.classList.remove('invisible');
    file3.parentElement.classList.remove('invisible');
    controls.classList.remove('invisible');
    chooser.classList.remove('invisible');
}

function overlayShown() {
    return overlay.classList.contains('shown');
}

function toggleInfo() {
    fileInfo.classList.toggle('invisible');
    previewHistogram.classList.toggle('invisible');
}

const fullscreenElement = document.documentElement;
function toggleFullscreen() {
    if (fullscreenElement.requestFullscreen) {
        if (isFullscreen()) {
            document.exitFullscreen();
        } else {
            fullscreenElement.requestFullscreen();
        }
    }
    const icon = isFullscreen() ? 'maximize' : 'minimize';
    fullscreen.innerHTML = '<i data-feather="' + icon + '"></i>';
    feather.replace();
}

function isFullscreen() {
    return document.fullscreen;
}

function selectAll() {
    if (!isSelected(0)) select(0);
    if (!isSelected(1)) select(1);
    if (!isSelected(2)) select(2);
}

function selectNone() {
    if (isSelected(0)) select(0);
    if (isSelected(1)) select(1);
    if (isSelected(2)) select(2);
}

function isSelected(i) {
    return !!(currentSet.length > i && selected[currentSet[i].SourceFile]);
}

function select(i) {
    if (!loader.classList.contains('hidden')) return;
    
    if (currentSet.length > i) {
        const file = currentSet[i].SourceFile;
        selected[file] = !selected[file];
    }

    const numFiles = getSelectedFiles().length;
    move.disabled = numFiles === 0;
    move.innerHTML = 'Move ' + (numFiles > 0 ? numFiles : '') + ' Files';

    // Set up "Are you sure you want to leave" prompt if there are selected files
    if (numFiles === 0) {
        window.onbeforeunload = null;
    } else {
        window.onbeforeunload = e => {
            e.preventDefault();
            return '';
        };
    }

    // Toggle based on state, the !! means convert from truthy to boolean
    section1.classList.toggle('selected', isSelected(0));
    section2.classList.toggle('selected', isSelected(1));
    section3.classList.toggle('selected', isSelected(2));

    if (overlayShown() && previewIndex === i) preview(previewIndex);
}

function getInfo(file, img, histogram) {
    // Calculate histogram
    if (img && histogram) calcHist(img, histogram);

    var info = '';
    info += file.FileName;
    info += '<br>' + parseDate(file.DateTime).toLocaleString();
    info += '<br>Aperture: F' + file.Aperture;
    info += '<br>ISO: ' + file.ISO + checkISO(file);
    info += '<br>Shutter Speed: ' + file.ShutterSpeed + checkShutter(file);
    info += '<br>Focal Length: ' + file.FocalLength;
    info += '<br>Bracket Value: ' + file.AEBBracketValue;
    return info;
}

function checkISO(file) {
    const iso = Number.parseInt(file.ISO);
    return iso > 1600 ? '<i data-feather="alert-triangle" class="warn"></i>' : '';
}

function checkShutter(file) {
    const shutterInverse = 1 / eval(file.ShutterSpeed);
    const focalLength = Number.parseInt(file.FocalLength.replace('mm', '').trim());
    return shutterInverse < focalLength ? '<i data-feather="alert-triangle" class="warn"></i>' : '';
}

function preview(i) {
    if (!loader.classList.contains('hidden')) return;

    if (i < 0) {
        back.click();
        preview(currentSet.length - 1);
        return;
    }

    if (i > currentSet.length - 1) {
        forward.click();
        return;
    }

    previewIndex = mod(i, currentSet.length);
    showOverlay();
    previewImg.src = currentSet[previewIndex].PreviewFile;
    download.href = currentSet[previewIndex].LargeFile;
    large.href = currentSet[previewIndex].LargeFile;
    overlayFile.innerHTML = getInfo(currentSet[previewIndex]);
    feather.replace();

    previewImg.classList.toggle('selected', !!selected[currentSet[previewIndex].SourceFile]);

    pager1.classList.toggle('hidden', currentSet.length < 1);
    pager2.classList.toggle('hidden', currentSet.length < 2);
    pager3.classList.toggle('hidden', currentSet.length < 3);

    pager1.classList.toggle('active', previewIndex === 0);
    pager2.classList.toggle('active', previewIndex === 1);
    pager3.classList.toggle('active', previewIndex === 2);
}

function update(i) {
    if (!loader.classList.contains('hidden')) return;

    setIndex = i;

    stats.innerText = 'Set: ' + (setIndex + 1) + ' / ' + setsLength + ', Total Files: ' + totalSize;
    pagerNumber.innerHTML = (setIndex + 1) + '/' + setsLength;

    section1.classList.add('hidden');
    section2.classList.add('hidden');
    section3.classList.add('hidden');

    section1.classList.remove('selected');
    section2.classList.remove('selected');
    section3.classList.remove('selected');

    image1.src = '';
    image2.src = '';
    image3.src = '';

    // 4 new lines so that things don't get funky with loading moving around layout
    file1.innerText = '';
    file2.innerText = '';
    file3.innerText = '';

    if (setIndex < setsLength) {
        const set = sets[Object.keys(sets)[setIndex]];
        currentSet = set;

        const width = set.length > 2 ? '33.3%' : set.length > 1 ? '50%' : '100%';
        section1.style.width = width;
        section2.style.width = width;
        section3.style.width = width;

        if (set.length > 0) {
            image1.src = set[0].ThumbnailFile;
            if (selected[set[0].SourceFile]) section1.classList.add('selected');
        }

        if (set.length > 1) {
            image2.src = set[1].ThumbnailFile;
            if (selected[set[1].SourceFile]) section2.classList.add('selected');
        }

        if (set.length > 2) {
            image3.src = set[2].ThumbnailFile;
            if (selected[set[2].SourceFile]) section3.classList.add('selected');
        }
    }

    if (overlayShown()) preview(0);
}

function parseDate(s) {
    var b = s.split(/\D/);
    return new Date(b[0],b[1]-1,b[2],b[3],b[4],b[5]);
}

function getSelectedFiles() {
    var files = [];

    const keys = Object.keys(selected);
    for (var i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (selected[key]) files.push(key);
    }

    return files;
}

function moveFiles() {
    const files = getSelectedFiles();
    if (!confirm('Are you sure you want to move ' + files.length + ' files?')) return;

    move.disabled = true;
    undo.disabled = true;
    loader.classList.remove('hidden');
    selected = {};

    axios.post('/move', { files: files }).then(data => {
        move.innerHTML = 'Move Files';
        undo.disabled = false;
        loader.classList.add('hidden');
        getData();
    }).catch((err) => {
        console.error(err);
        move.innerHTML = 'Move Files';
        undo.disabled = false;
        loader.classList.add('hidden');
    });
}

function undoMove() {
    if (!confirm('Are you sure you want to undo ALL changes?')) return;

    undo.disabled = true;
    move.disabled = true;
    loader.classList.remove('hidden');

    axios.post('/undo').then(data => {
        undo.disabled = false;
        move.disabled = false;
        loader.classList.add('hidden');
        getData();
    }).catch((err) => {
        console.error(err);
        undo.disabled = false;
        move.disabled = false;
        loader.classList.add('hidden');
    });
}