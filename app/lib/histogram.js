// Code adapted from http://mihai.sucan.ro/coding/svg-or-canvas/histogram.html

function calcHist(img, histCanvas, step = 1) {
  const imgCanvas = document.createElement('canvas');
  const imgCtx = imgCanvas.getContext('2d');

  // Draw image onto a temp canvas to get image data
  imgCanvas.width = img.naturalWidth;
  imgCanvas.height = img.naturalHeight;
  imgCtx.drawImage(img, 0, 0);
  var imgData = imgCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data;

  const histCtx = histCanvas.getContext('2d'),
    colors = ['#f00', '#0f0', '#00f'];

  var chans = [[], [], []],
    maxCount = 0,
    val;

  // count every 1 pixel, move +4 indicies for rgba in array
  step *= 4;

  for (var i = 0, n = imgData.length; i < n; i+= step) {
    val = [imgData[i], imgData[i+1], imgData[i+2]];

    for (var y = 0, m = val.length; y < m; y++) {
      if (val[y] in chans[y]) {
        chans[y][val[y]]++;
      } else {
        chans[y][val[y]] = 1;
      }

      if (chans[y][val[y]] > maxCount) {
        maxCount = chans[y][val[y]];
      }
    }
  }

  // nothing to do if no data
  if (maxCount === 0) return;

  // wipe canvas and draw new histogram
  histCtx.clearRect(0, 0, histCanvas.width, histCanvas.height);
  for (var i = 0, n = chans.length; i < n; i++) {
    drawHist(colors[i], chans[i], maxCount, histCanvas, histCtx);
  }
}

function drawHist(color, vals, maxCount, histCanvas, histCtx) {
  histCtx.lineWidth = 4;
  histCtx.strokeStyle = color;

  histCtx.beginPath();
  histCtx.moveTo(0, histCanvas.height);

  for (var x, y, i = 0; i <= 255; i++) {
    if (!(i in vals)) {
      continue;
    }

    y = Math.round((vals[i]/maxCount)*histCanvas.height);
    x = Math.round((i/255)*histCanvas.width);

    histCtx.lineTo(x, histCanvas.height - y);
  }

  histCtx.lineTo(x, histCanvas.height);
  histCtx.stroke();
  histCtx.closePath();
}