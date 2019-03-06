var setIndex = 0;
var previewIndex = 0;
var sets = [];
var setsLength = 0;
var totalSize = 0;
var selected = {};
var currentSet = [];

const mod = (x, n) => (x % n + n) % n;

window.onload = () => {
    feather.replace();

    back.addEventListener("click", () => update(mod(setIndex - 1, setsLength)));
    forward.addEventListener("click", () => update(mod(setIndex + 1, setsLength)));
    backLarge.addEventListener("click", () => update(mod(setIndex - 5, setsLength)));
    forwardLarge.addEventListener("click", () => update(mod(setIndex + 5, setsLength)));
    
    // reset.addEventListener("click", () => update(0));
    move.addEventListener("click", moveFiles);
    undo.addEventListener("click", undoMove);
    
    image1.addEventListener("click", () => select(0));
    image2.addEventListener("click", () => select(1));
    image3.addEventListener("click", () => select(2));
    
    previewImg.addEventListener("click", () => select(previewIndex));

    preview1.addEventListener("click", () => preview(0));
    preview2.addEventListener("click", () => preview(1));
    preview3.addEventListener("click", () => preview(2));

    pager1.addEventListener("click", (e) => { e.stopPropagation(); preview(0); });
    pager2.addEventListener("click", (e) => { e.stopPropagation(); preview(1); });
    pager3.addEventListener("click", (e) => { e.stopPropagation(); preview(2); });

    overlay.addEventListener("click", (e) => { if (e.target !== previewImg) hideOverlay() });

    image1.addEventListener("load", () => { file1.innerText = getInfo(currentSet[0]); section1.style.display = "inline"; });
    image2.addEventListener("load", () => { file2.innerText = getInfo(currentSet[1]); section2.style.display = "inline"; });
    image3.addEventListener("load", () => { file3.innerText = getInfo(currentSet[2]); section3.style.display = "inline"; });
    
    document.onkeydown = checkKey;

    new Hammer(images).on('swipeleft', () => forward.click());
    new Hammer(images).on('swiperight', () => back.click());

    new Hammer(overlay).on('swipeleft', () => preview(previewIndex + 1));
    new Hammer(overlay, { recognizers: [[Hammer.Swipe, { pointers: 2 }]]}).on('swipeleft', () => forward.click());

    new Hammer(overlay).on('swiperight', () => preview(previewIndex - 1));
    new Hammer(overlay, { recognizers: [[Hammer.Swipe, { pointers: 2 }]]}).on('swiperight', () => back.click());

    const pinchOut = { recognizers: [[ Hammer.Pinch, { enable: true, threshold: 1.25 } ]] };
    const pinchIn = { recognizers: [[ Hammer.Pinch, { enable: true, threshold: 0.5 } ]] };

    new Hammer(image1, pinchOut).on('pinchout', () => preview(0));
    new Hammer(image2, pinchOut).on('pinchout', () => preview(1));
    new Hammer(image3, pinchOut).on('pinchout', () => preview(2));
    new Hammer(overlay, pinchIn).on('pinchin', () => hideOverlay());

    getData();
}

function checkKey(e) {
    e = e || window.event;

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
    } else if (e.keyCode == '27') { // esc
        hideOverlay();
    } else if (e.keyCode == '32' || e.keyCode == '82') { // space, r
        if (overlayShown()) {
            select(previewIndex);
        }
    } else if (e.keyCode == '81') { // q
        preview(0);
    } else if (e.keyCode == '87') { // w
        preview(1);
    } else if (e.keyCode == '69') { // e
        preview(2);
    } else if (e.keyCode == '90') { // z
        if (overlayShown()) {
            hideOverlay();
        } else {
            preview(0);
        }
    } else if (e.keyCode == '191') { // "/"
        forward.click();
    } else if (e.keyCode == '190') { // "."
        back.click();
    }
}

function getData() {
    axios.get('/data').then(data => {
        sets = data.data;

        const keys = Object.keys(sets);
        setsLength = keys.length;
        
        totalSize = 0;
        for (var i = 0; i < keys.length; i++) {
            totalSize += sets[keys[i]].length;
        }

        update(mod(setIndex, setsLength));
    }).catch((err) => {
        console.error(err);
    });
}

function showOverlay() {
    overlay.classList.add("shown");
}

function hideOverlay() {
    overlay.classList.remove("shown");
}

function overlayShown() {
    return overlay.classList.contains("shown");
}

function select(i) {
    if (currentSet.length > i) {
        const file = currentSet[i].SourceFile;
        selected[file] = !selected[file];
    }

    const numFiles = getSelectedFiles().length;
    move.disabled = numFiles === 0;
    move.innerHTML = "Move " + (numFiles > 0 ? numFiles : "") + " Files";

    // Toggle based on state, the !! means convert from truthy to boolean
    section1.classList.toggle("selected", !!(currentSet.length > 0 && selected[currentSet[0].SourceFile]));
    section2.classList.toggle("selected", !!(currentSet.length > 1 && selected[currentSet[1].SourceFile]));
    section3.classList.toggle("selected", !!(currentSet.length > 2 && selected[currentSet[2].SourceFile]));

    if (overlayShown() && previewIndex === i) preview(previewIndex);
}

function getInfo(file) {
    return file.FileName + "\nAperture: F" + file.Aperture + "\nISO: " + file.ISO + "\nShutter Speed: " + file.ShutterSpeed +
        "\nFocal Length: " + file.FocalLength + "\nBracket Value: " + file.AEBBracketValue;
}

function preview(i) {
    previewIndex = mod(i, currentSet.length);
    showOverlay();
    previewImg.src = currentSet[previewIndex].PreviewFile;

    previewImg.style.boxShadow = selected[currentSet[previewIndex].SourceFile] ? "0 0 4em rgba(255, 0, 0, 0.75)" : "";

    pager1.style.display = currentSet.length > 0 ? "inline" : "none";
    pager2.style.display = currentSet.length > 1 ? "inline" : "none";
    pager3.style.display = currentSet.length > 2 ? "inline" : "none";

    pager1.classList.toggle("active", previewIndex === 0);
    pager2.classList.toggle("active", previewIndex === 1);
    pager3.classList.toggle("active", previewIndex === 2);
}

function update(i) {
    setIndex = i;

    stats.innerText = "Set: " + (setIndex + 1) + " / " + setsLength + ", Total Files: " + totalSize;

    section1.style.display = "none";
    section2.style.display = "none";
    section3.style.display = "none";

    image1.src = "";
    image2.src = "";
    image3.src = "";

    // 4 new lines so that things don't get funky with loading moving around layout
    file1.innerText = "";
    file2.innerText = "";
    file3.innerText = "";

    section1.classList.remove("selected");
    section2.classList.remove("selected");
    section3.classList.remove("selected");

    if (setIndex < setsLength) {
        const set = sets[Object.keys(sets)[setIndex]];
        currentSet = set;

        const width = set.length > 2 ? "32.5%" : set.length > 1 ? "49.5%" : "99%";
        section1.style.width = width;
        section2.style.width = width;
        section3.style.width = width;

        if (set.length > 0) {
            image1.src = set[0].PreviewFile;
            if (selected[set[0].SourceFile]) section1.classList.add("selected");
        }

        if (set.length > 1) {
            image2.src = set[1].PreviewFile;
            if (selected[set[1].SourceFile]) section2.classList.add("selected");
        }

        if (set.length > 2) {
            image3.src = set[2].PreviewFile;
            if (selected[set[2].SourceFile]) section3.classList.add("selected");
        }
    }

    if (overlayShown()) preview(0);
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
    if (!confirm("Are you sure you want to move " + files.length + " files?")) return;

    move.disabled = true;
    undo.disabled = true;
    loader.style.display = "inline-block";
    selected = {};

    axios.post('/move', { files: files }).then(data => {
        move.innerHTML = "Move Files";
        undo.disabled = false;
        loader.style.display = "none";
        getData();
    }).catch((err) => {
        console.error(err);
        move.innerHTML = "Move Files";
        undo.disabled = false;
        loader.style.display = "none";
    });
}

function undoMove() {
    if (!confirm("Are you sure you want to undo ALL changes?")) return;

    undo.disabled = true;
    move.disabled = true;
    loader.style.display = "inline-block";

    axios.post('/undo').then(data => {
        undo.disabled = false;
        move.disabled = false;
        loader.style.display = "none";
        getData();
    }).catch((err) => {
        console.error(err);
        undo.disabled = false;
        move.disabled = false;
        loader.style.display = "none";
    });
}