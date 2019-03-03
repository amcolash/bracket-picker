var setIndex = 0;
var sets = [];
var setsLength = 0;
var selected = {};
var currentSet = [];

// TODO Hover zoom, speed up metadata?, smoother loading display, spinner sizing

const mod = (x, n) => (x % n + n) % n;

window.onload = () => {
    getData();

    back.addEventListener("click", () => update(mod(setIndex - 1, setsLength)));
    forward.addEventListener("click", () => update(mod(setIndex + 1, setsLength)))
    backLarge.addEventListener("click", () => update(mod(setIndex - 5, setsLength)))
    forwardLarge.addEventListener("click", () => update(mod(setIndex + 5, setsLength)))

    reset.addEventListener("click", () => update(0));
    move.addEventListener("click", moveFiles);

    image1.addEventListener("click", () => select(1));
    image2.addEventListener("click", () => select(0));
    image3.addEventListener("click", () => select(2));

    image2.addEventListener("load", () => file2.innerText = getInfo(currentSet[0]));
    image1.addEventListener("load", () => file1.innerText = getInfo(currentSet[1]));
    image3.addEventListener("load", () => file3.innerText = getInfo(currentSet[2]));

    document.onkeydown = checkKey;
}

function checkKey(e) {
    e = e || window.event;

    // Call click function to use the same logic as the buttons
    if (e.keyCode == '13' && e.ctrlKey) { // Enter
        moveFiles();
    } else if (e.keyCode == '37') { // Left Arrow
       back.click();
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

    update(setIndex);
}

function getInfo(file) {
    return file.FileName + "\nF " + file.Aperture + "\n ISO " + file.ISO + "\n Shutter Speed " + file.ShutterSpeed;
}

function update(i) {
    setIndex = i;

    stats.innerText = "Set: " + setIndex + " / " + setsLength;

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
        
        section2.style.display = set.length > 0 ? "inline" : "none";
        section1.style.display = set.length > 1 ? "inline" : "none";
        section3.style.display = set.length > 2 ? "inline" : "none";
    }
}

function moveFiles() {
    move.disabled = true;
    loader.style.display = "inline-block";
    var files = [];

    const keys = Object.keys(selected);
    for (var i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (selected[key]) files.push(key);
    }

    axios.post('/move', { files: files }).then(data => {
        console.log(data);
        move.disabled = false;
        loader.style.display = "none";
        getData();
    }).catch((err) => {
        move.disabled = false;
        console.error(err);
        loader.style.display = "none";
    });
}