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
    overlay.style.display = "none";

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
    
    preview1.addEventListener("click", () => preview(0));
    preview2.addEventListener("click", () => preview(1));
    preview3.addEventListener("click", () => preview(2));

    overlay.addEventListener("click", () => overlay.style.display = "none");

    image1.addEventListener("load", () => { file1.innerText = getInfo(currentSet[0]); section1.style.display = "inline"; });
    image2.addEventListener("load", () => { file2.innerText = getInfo(currentSet[1]); section2.style.display = "inline"; });
    image3.addEventListener("load", () => { file3.innerText = getInfo(currentSet[2]); section3.style.display = "inline"; });
    
    document.onkeydown = checkKey;

    getData();
}

function checkKey(e) {
    e = e || window.event;

    // Call click function to use the same logic as the buttons
    if (e.keyCode == '13' && e.ctrlKey) { // Enter + Ctrl
        moveFiles();
    } else if (e.keyCode == '37' && e.ctrlKey) { // Left Arrow + Ctrl
        if (overlay.style.display !== "none") {
            back.click();
            preview(0);
        } else {
            backLarge.click();
        }
    } else if (e.keyCode == '37') { // Left Arrow
        if (overlay.style.display !== "none") {
            preview(previewIndex - 1);
        } else {
            back.click();
        }
    } else if (e.keyCode == '39' && e.ctrlKey) { // Right Arrow + Ctrl
        if (overlay.style.display !== "none") {
            forward.click();
            preview(0);
        } else {
            forwardLarge.click();
        }
    } else if (e.keyCode == '39') { // Right Arrow
        if (overlay.style.display !== "none") {
            preview(previewIndex + 1);
        } else {
            forward.click();
        }
    } else if (e.keyCode == '49') { // 1
        if (overlay.style.display === "none") select(0);
    } else if (e.keyCode == '50') { // 2
        if (overlay.style.display === "none") select(1);
    } else if (e.keyCode == '51') { // 3
        if (overlay.style.display === "none") select(2);
    } else if (e.keyCode == '27') { // esc
        overlay.style.display = "none";
    } else if (e.keyCode == '32' || e.keyCode == '82' || e.keyCode == '16') { // space, r, right shift
        if (overlay.style.display !== "none") {
            select(previewIndex);
            preview(previewIndex);
        }
    } else if (e.keyCode == '81') { // q
        preview(0);
    } else if (e.keyCode == '87') { // w
        preview(1);
    } else if (e.keyCode == '69') { // e
        preview(2);
    } else if (e.keyCode == '90') { // z
        if (overlay.style.display !== "none") {
            overlay.style.display = "none";
        } else {
            preview(0);
        }
    } else if (e.keyCode == '191') { // "/"
        forward.click();
        preview(1);
    } else if (e.keyCode == '190') { // "."
        back.click();
        preview(0);
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

function select(i) {
    if (currentSet.length > i) {
        const file = currentSet[i].SourceFile;
        selected[file] = !selected[file];
    }
    
    section1.classList.remove("selected");
    section2.classList.remove("selected");
    section3.classList.remove("selected");

    const numFiles = getSelectedFiles().length;
    move.disabled = numFiles === 0;
    move.innerHTML = "Move " + (numFiles > 0 ? numFiles : "") + " Files";
    
    if (currentSet.length > 0 && selected[currentSet[0].SourceFile]) section1.classList.add("selected");
    if (currentSet.length > 1 && selected[currentSet[1].SourceFile]) section2.classList.add("selected");
    if (currentSet.length > 2 && selected[currentSet[2].SourceFile]) section3.classList.add("selected");
}

function getInfo(file) {
    return file.FileName + "\nAperture: F" + file.Aperture + "\nISO: " + file.ISO + "\nShutter Speed: " + file.ShutterSpeed +
        "\nFocal Length: " + file.FocalLength + "\nBracket Value: " + file.AEBBracketValue;
}

function preview(i) {
    previewIndex = mod(i, currentSet.length);
    overlay.style.display = "flex";
    previewImg.src = currentSet[previewIndex].PreviewFile;

    previewImg.style.boxShadow = selected[currentSet[previewIndex].SourceFile] ? "0 0 4em rgba(255, 0, 0, 0.75)" : "";
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