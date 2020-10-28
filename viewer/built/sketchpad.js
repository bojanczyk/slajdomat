export { toggleSketchpad };
// works out the X, Y position of the click inside the canvas from the X, Y position on the page
function getPosition(mouseEvent, sigCanvas) {
    if (is_touch_device) {
        // get the touch coordinates.  Using the first touch in case of multi-touch
        var coors = {
            x: mouseEvent.targetTouches[0].pageX,
            y: mouseEvent.targetTouches[0].pageY
        };
        // Now we need to get the offset of the canvas location
        var obj = sigCanvas;
        if (obj.offsetParent) {
            // Every time we find a new object, we add its offsetLeft and offsetTop to curleft and curtop.
            do {
                coors.x -= obj.offsetLeft;
                coors.y -= obj.offsetTop;
            } while ((obj = obj.offsetParent) != null);
        }
        // pass the coordinates to the appropriate handler
        return coors;
    }
    else {
        var rect = sigCanvas.getBoundingClientRect();
        return {
            x: ratio * (mouseEvent.clientX - rect.left),
            y: ratio * (mouseEvent.clientY - rect.top)
        };
    }
}
var is_touch_device;
var isDrawing = false;
var sigCanvas;
var context;
var curPath;
var curPathText;
var ratio;
function draw(event) {
    var coors = getPosition(event, sigCanvas);
    function addPoint() {
        // context.lineTo(coors.x, coors.y);
        // context.stroke();
        curPathText += ' L ' + coors.x + ' ' + coors.y;
        curPath.setAttributeNS(null, 'd', curPathText);
    }
    if (event.type == 'touchstart' || event.type == 'mousedown') {
        // context.beginPath();
        // context.moveTo(coors.x, coors.y);
        console.log(coors);
        curPath = document.createElementNS('http://www.w3.org/2000/svg', "path");
        curPathText = 'M ' + coors.x + ' ' + coors.y;
        curPath.setAttributeNS(null, 'd', curPathText);
        curPath.setAttributeNS(null, 'stroke', 'red');
        sigCanvas.appendChild(curPath);
        isDrawing = true;
    }
    if (event.type == 'touchmove' || event.type == 'mousemove') {
        if (isDrawing) {
            addPoint();
        }
    }
    if (event.type == 'touchend' || event.type == 'mouseup' || event.type == 'mouseout') {
        console.log('finish ' + event.type);
        if (isDrawing) {
            addPoint();
            isDrawing = false;
        }
    }
}
var sketchpadVisible = false;
function toggleSketchpad(node) {
    if (sketchpadVisible) {
        document.getElementById('iframe').style.display = 'none';
        sketchpadVisible = !sketchpadVisible;
    }
    else {
        document.getElementById('iframe').style.display = '';
        sketchpadVisible = !sketchpadVisible;
        // get references to the canvas element as well as the 2D drawing context
        sigCanvas = document.getElementById('svg');
        ratio = 1280 / sigCanvas.getBoundingClientRect().width;
        // console.log(sigCanvas.getBoundingClientRect());
        // console.log(sigCanvas);
        // sigCanvas.setAttribute('viewBox','0 0 600 600');
        // const boundRect = sigCanvas.getBoundingClientRect();
        // sigCanvas.width = boundRect.width;
        // sigCanvas.height = boundRect.height;
        // // sigCanvas.width=700;
        // context = sigCanvas.getContext("2d");
        // context.strokeStyle = "blue";
        // context.lineJoin = "round";
        // context.lineWidth = 3;
        var frame = document.getElementById('iframe');
        // This will be defined on a TOUCH device such as iPad or Android, etc.
        is_touch_device = 'ontouchstart' in document.documentElement;
        if (is_touch_device) {
            // attach the touchstart, touchmove, touchend event listeners.
            frame.addEventListener('touchstart', draw, false);
            frame.addEventListener('touchmove', draw, false);
            frame.addEventListener('touchend', draw, false);
            // prevent elastic scrolling
            frame.addEventListener('touchmove', function (event) {
                event.preventDefault();
            }, false);
        }
        else {
            frame.addEventListener('mousedown', draw, false);
            frame.addEventListener('mousemove', draw, false);
            frame.addEventListener('mouseup', draw, false);
            // frame.addEventListener('mouseout', draw,false);
        }
    }
}
// Clear the canvas context using the canvas width and height
function clearCanvas(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
//# sourceMappingURL=sketchpad.js.map