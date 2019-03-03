var setIndex = 0;
var sets = [];
var setsLength = 0;

window.onload = () => {
    axios.get('/data').then(data => {
        sets = data.data;
        setsLength = Object.keys(sets).length;
        update(mod(setIndex, setsLength));
    });

    back.addEventListener("click", () => update(mod(setIndex - 1, setsLength)));
    forward.addEventListener("click", () => update(mod(setIndex + 1, setsLength)))
    backLarge.addEventListener("click", () => update(mod(setIndex - 5, setsLength)))
    forwardLarge.addEventListener("click", () => update(mod(setIndex + 5, setsLength)))
    reset.addEventListener("click", () => update(0));

    document.onkeydown = checkKey;
}


function checkKey(e) {
    e = e || window.event;

    // Call click function to use the same logic as the buttons
    if (e.keyCode == '37') { // Left Arrow
       back.click();
    } else if (e.keyCode == '39') { // Right Arrow
       forward.click();
    } else if (e.keyCode == '49') { // 1
        select(0);
    } else if (e.keyCode == '50') { // 2
        select(1);
    } else if (e.keyCode == '51') { // 3
        select(2);
    }
}

const mod = (x, n) => (x % n + n) % n;

function select(i) {
    section1.classList.remove("selected");
    section2.classList.remove("selected");
    section3.classList.remove("selected");

    switch(i) {
        case 0:
            section1.classList.add("selected");
            break;
        case 1:
            section2.classList.add("selected");
            break;
        case 2:
            section3.classList.add("selected");
            break;
    }
}

function getInfo(file) {
    return file.FileName + "\nF " + file.Aperture + "\n ISO " + file.ISO + "\n Shutter Speed " + file.ShutterSpeed;
}

function update(i) {
    setIndex = i;

    stats.innerText = "Index: " + setIndex;

    image1.src = "";
    image2.src = "";
    image3.src = "";

    file1.innerText = "";
    file2.innerText = "";
    file3.innerText = "";

    section1.classList.remove("selected");
    section2.classList.remove("selected");
    section3.classList.remove("selected");

    if (setIndex < setsLength) {
        const set = sets[Object.keys(sets)[setIndex]];
        if (set.length > 0) {
            image2.src = set[0].PreviewFile;
            file2.innerText = getInfo(set[0]);
        }

        if (set.length > 1) {
            image1.src = set[1].PreviewFile;
            file1.innerText = getInfo(set[1]);
        }

        if (set.length > 2) {
            image3.src = set[2].PreviewFile;
            file3.innerText = getInfo(set[2]);
        }
        
        image2.style.display = set.length > 0 ? "inline" : "none";
        image1.style.display = set.length > 1 ? "inline" : "none";
        image3.style.display = set.length > 2 ? "inline" : "none";
    }
}