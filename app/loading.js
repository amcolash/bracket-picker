window.onload = () => {
    getState();
    setInterval(getState, 1000);
};

function getState() {
    axios.get('/state').then(response => {
        // If loading complete, reload the page
        if (response.data.text === 'Complete' && window.location.pathname === '/') {
            window.location.reload();
        } else {
            app.style.opacity = '1';
            state.innerHTML = response.data.text;
            progress.innerHTML = response.data.text === 'Complete' ? '&nbsp;' : response.data.progress;
        }
    }).catch(err => {
        //console.error(err);
    });
}