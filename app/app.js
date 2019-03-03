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
}

const mod = (x, n) => (x % n + n) % n;

function update(i) {
    setIndex = i;

    stats.innerText = "Index: " + setIndex;

    image1.src = "";
    image2.src = "";
    image3.src = "";

    file1.innerText = "";
    file2.innerText = "";
    file3.innerText = "";

    if (setIndex < setsLength) {
        const set = sets[Object.keys(sets)[setIndex]];
        if (set.length > 0) {
            image2.src = set[0].PreviewFile;
            file2.innerText = set[0].FileName;
            console.log(set[0].Orientation);
        }

        if (set.length > 1) {
            image1.src = set[1].PreviewFile;
            file1.innerText = set[1].FileName;
        }

        if (set.length > 2) {
            image3.src = set[2].PreviewFile;
            file3.innerText = set[2].FileName;
        }
        
        image2.style.display = set.length > 0 ? "inline" : "none";
        image1.style.display = set.length > 1 ? "inline" : "none";
        image3.style.display = set.length > 2 ? "inline" : "none";
    }
}