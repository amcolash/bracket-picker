var setIndex = 0;
var sets = [];
var setsLength = 0;
var selected = {};
var currentSet = [];

// TODO Hover zoom, speed up metadata?, smoother loading display, spinner sizing, resize images?

const mod = (x, n) => (x % n + n) % n;

window.onload = () => {
    back.addEventListener("click", () => update(mod(setIndex - 1, setsLength)));
    forward.addEventListener("click", () => update(mod(setIndex + 1, setsLength)));
    backLarge.addEventListener("click", () => update(mod(setIndex - 5, setsLength)));
    forwardLarge.addEventListener("click", () => update(mod(setIndex + 5, setsLength)));
    
    reset.addEventListener("click", () => update(0));
    move.addEventListener("click", moveFiles);
    undo.addEventListener("click", undoMove);
    
    image1.addEventListener("click", () => select(1));
    image2.addEventListener("click", () => select(0));
    image3.addEventListener("click", () => select(2));
    
    image2.addEventListener("load", () => { file2.innerText = getInfo(currentSet[0]); section2.style.display = "inline"; });
    image1.addEventListener("load", () => { file1.innerText = getInfo(currentSet[1]); section1.style.display = "inline"; });
    image3.addEventListener("load", () => { file3.innerText = getInfo(currentSet[2]); section3.style.display = "inline"; });
    
    document.onkeydown = checkKey;

    feather.replace();
    getData();
}

function checkKey(e) {
    e = e || window.event;

    // Call click function to use the same logic as the buttons
    if (e.keyCode == '13' && e.ctrlKey) { // Enter + Ctrl
        moveFiles();
    } else if (e.keyCode == '37' && e.ctrlKey) { // Left Arrow + Ctrl
        backLarge.click();
    } else if (e.keyCode == '37') { // Left Arrow
       back.click();
    } else if (e.keyCode == '39' && e.ctrlKey) { // Right Arrow + Ctrl
        forwardLarge.click();
    } else if (e.keyCode == '39') { // Right Arrow
       forward.click();
    } else if (e.keyCode == '49') { // 1
        select(1);
    } else if (e.keyCode == '50') { // 2
        select(0);
    } else if (e.keyCode == '51') { // 3
        select(2);
    }
}

function getData() {
    axios.get('/data').then(data => {
        sets = data.data;
        setsLength = Object.keys(sets).length;
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
    
    if (currentSet.length > 0 && selected[currentSet[0].SourceFile]) section2.classList.add("selected");
    if (currentSet.length > 1 && selected[currentSet[1].SourceFile]) section1.classList.add("selected");
    if (currentSet.length > 2 && selected[currentSet[2].SourceFile]) section3.classList.add("selected");
}

function getInfo(file) {
    return file.FileName + "\nF " + file.Aperture + "\n ISO " + file.ISO + "\n Shutter Speed " + file.ShutterSpeed;
}

function update(i) {
    setIndex = i;

    stats.innerText = "Set: " + setIndex + " / " + setsLength;

    section1.style.display = "none";
    section2.style.display = "none";
    section3.style.display = "none";

    image1.src = "";
    image2.src = "";
    image3.src = "";

    // 4 new lines so that things don't get funky with loading moving around layout
    file1.innerText = "\n\n\n\n";
    file2.innerText = "\n\n\n\n";
    file3.innerText = "\n\n\n\n";

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
            image2.src = set[0].PreviewFile;
            if (selected[set[0].SourceFile]) section2.classList.add("selected");
        }

        if (set.length > 1) {
            image1.src = set[1].PreviewFile;
            if (selected[set[1].SourceFile]) section1.classList.add("selected");
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
    move.disabled = true;
    loader.style.display = "inline-block";
    const files = getSelectedFiles();
    selected = {};

    axios.post('/move', { files: files }).then(data => {
        move.disabled = false;
        move.innerHTML = "Move Files";
        loader.style.display = "none";
        getData();
    }).catch((err) => {
        console.error(err);
        move.disabled = false;
        move.innerHTML = "Move Files";
        loader.style.display = "none";
    });
}

function undoMove() {
    undo.disabled = true;
    loader.style.display = "inline-block";

    axios.post('/undo').then(data => {
        undo.disabled = false;
        loader.style.display = "none";
        getData();
    }).catch((err) => {
        console.error(err);
        undo.disabled = false;
        loader.style.display = "none";
    });
}