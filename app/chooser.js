var loading = false;
var baseDir;

window.onload = () => {
    axios.get('/dirs').then(data => {
        const dirs = data.data.dirs;
        baseDir = data.data.baseDir;
        dirList.style.display = 'block';
        recursive(dirs, dirList, '/');
        feather.replace();
    }).catch((err) => {
        console.error(err);
    });
};

// Used for sorting
const months = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

function recursive(path, el, name) {
    if (Array.isArray(path)) {

        // Sort by month names (if present), fall back to normal sorting
        path = path.sort((a, b) => {
            const indexA = months.indexOf(a.name);
            const indexB = months.indexOf(b.name);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            else return a.name - b.name;
        });

        for (var i = 0; i < path.length; i++) {
            recursive(path[i], el, name);
        }

        return;
    }

    const filePath = name + (name.length > 1 ? '/' : '') + path.name;
    
    if (name.indexOf(baseDir) !== -1) {
        var dir = document.createElement('div');
        const isNested = el.classList.contains('dir');
        dir.classList = 'dir' + (isNested ? ' nested' : ' root');
        el.appendChild(dir);
        
        const file = document.createElement('div');
        file.classList.add('file');
    
        file.filePath = filePath;
    
        if (path.useful) {
            file.addEventListener('click', (e) => { e.stopPropagation(); chooseDir(file) });
            file.classList.add('hover');
        } else {
            file.classList.add('disabled');
            if (isNested) file.classList.add('hidden');
        }
    
        const icon = document.createElement('i');
        icon.setAttribute('data-feather', 'corner-down-right');
    
        if (isNested) file.appendChild(icon);
        file.innerHTML += path.name;
        if (dir) dir.appendChild(file);
    }

    if (path.children) {
        recursive(path.children, dir || el, filePath);
    }
}

function chooseDir(dir) {
    if (loading) return;
    loading = true;
    
    const spinner = document.createElement('div');
    spinner.className = 'lds-dual-ring';
    
    dir.style.paddingRight = '0.5em';
    dir.appendChild(spinner);
    
    const files = document.getElementsByClassName('hover');
    for (var i = 0; i < files.length; i++) {
        files[i].classList.add('noHover');
    }

    axios.post('/dir', { dir: dir.filePath }).then(response => {
        window.location.pathname = '';
    }).catch(err => {
        console.error(err);
    });
}