var height = 160;

window.onload = () => {
  axios.get('/dir').then(response => {
      if (!response.data.dir) {
        window.location.pathname = '/';
      } else {
        folder.innerText = response.data.relative;
        feather.replace();
        axios.get('/data').then(response => {
          const sets = response.data.sets;
          const keys = Object.keys(sets);
          for (var i = 0; i < keys.length; i++) {
            const set = sets[keys[i]];
            for (var j = 0; j < set.length; j++) {
              const div = document.createElement('div');
              const a = document.createElement('a');
              const img = document.createElement('img');

              div.className = 'image';
              
              a.href = set[j].PreviewFile;
              a.title = set[j].ThumbnailFile.replace('/previews/tn_', '');

              img.src = set[j].ThumbnailFile;
              img.alt = set[j].ThumbnailFile.replace('/previews/tn_', '');

              div.appendChild(a);
              a.appendChild(img);
              gallery.appendChild(div);
            }
          }

          $("#gallery").justifiedGallery({
            rowHeight: height,
            margins: 12
          });

          $('#gallery a').simpleLightbox({
            captionsData: 'alt',
            captionPosition: 'outside',
            showCounter: true
          });

          zoomout.addEventListener('click', () => {
            height *= 0.75;
            $("#gallery").justifiedGallery({
              rowHeight: height,
              margins: 12
            });
          });

          zoomin.addEventListener('click', () => {
            height *= 1.25;
            $("#gallery").justifiedGallery({
              rowHeight: height,
              margins: 12
            });
          });
        }).catch(err => {
          console.error(err);
        });
      }
  }).catch((err) => {
      console.error(err);
  });
};