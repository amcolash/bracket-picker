var loading = false;
var baseDir;

window.onload = () => {
    axios.get('/dirs').then(data => {
        const dirs = data.data.dirs;
        baseDir = data.data.baseDir;
        dirList.style.display = 'block';
        recursive(dirs, dirList, '');
        feather.replace();
    }).catch((err) => {
        console.error(err);
    });
};

function recursive(path, el, name) {
    if (Array.isArray(path)) {
        path = path.sort();
        for (var i = 0; i < path.length; i++) {
            recursive(path[i], el, name);
        }

        return;
    }

    var dir;
    if (path.name.length > 0) {
        dir = document.createElement('div');
        dir.classList = 'dir' + (el.classList.contains('dir') ? ' nested' : '');
        el.appendChild(dir);
    }
    
    const file = document.createElement('div');
    file.addEventListener('click', (e) => { e.stopPropagation(); chooseDir(file) });
    const isNested = name.length !== 0;
    file.className = 'hover';
    file.filePath = name + (isNested ? '/' : '') + path.name;

    const icon = document.createElement('i');
    icon.setAttribute('data-feather', 'corner-down-right');

    if (isNested) file.appendChild(icon);
    file.innerHTML += path.name;
    if (dir) dir.appendChild(file);

    if (path.children) {
        recursive(path.children, dir || el, file.filePath);
    }
}

function chooseDir(dir) {
    if (loading) return;
    loading = true;
    
    const path = baseDir + '/' + dir.filePath;
    
    const spinner = document.createElement('div');
    spinner.className = 'lds-dual-ring';
    
    dir.style.paddingRight = '0.5em';
    dir.appendChild(spinner);
    
    const files = document.getElementsByClassName('hover');
    for (var i = 0; i < files.length; i++) {
        files[i].classList.add('noHover');
    }

    axios.post('/dir', { dir: path }).then(response => {
        window.location.pathname = '';
    }).catch(err => {
        console.error(err);
    });
}