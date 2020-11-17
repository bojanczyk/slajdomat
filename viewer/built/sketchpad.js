export { toggleSketchpad };
var is_touch_device;
var isDrawing = false;
var sigCanvas;
var curPath;
var curPathText;
var selectedColor = null;
var matrix;
var punkt;
var undoStack = [];
var undoIndex = -1;
function draw(event) {
    if (event.type == 'touchstart' || event.type == 'mousedown') {
        if (selectedColor != null) {
            matrix = sigCanvas.getScreenCTM().inverse();
            isDrawing = true;
        }
    }
    if (isDrawing) {
        if (is_touch_device) {
            punkt.x = event.targetTouches[0].pageX;
            punkt.y = event.targetTouches[0].pageY;
        }
        else {
            punkt.x = event.clientX;
            punkt.y = event.clientY;
        }
        punkt = punkt.matrixTransform(matrix);
    }
    // getPosition(event, sigCanvas);
    function addPoint() {
        curPathText += ' L ' + punkt.x + ' ' + punkt.y;
        curPath.setAttributeNS(null, 'd', curPathText);
    }
    if (event.type == 'touchstart' || event.type == 'mousedown') {
        // context.beginPath();
        // context.moveTo(coors.x, coors.y);
        curPath = document.createElementNS('http://www.w3.org/2000/svg', "path");
        curPathText = 'M ' + punkt.x + ' ' + punkt.y;
        curPath.setAttributeNS(null, 'd', curPathText);
        curPath.setAttributeNS(null, 'stroke', selectedColor);
        curPath.setAttributeNS(null, 'stroke-width', matrix.a);
        sigCanvas.appendChild(curPath);
        undoStack.splice(undoIndex + 1);
        undoStack.push(curPath);
        undoIndex += 1;
        undoButtons();
    }
    if (event.type == 'touchmove' || event.type == 'mousemove') {
        if (isDrawing) {
            addPoint();
        }
    }
    if (event.type == 'touchend' || event.type == 'mouseup' || event.type == 'mouseout') {
        if (isDrawing) {
            addPoint();
            isDrawing = false;
        }
    }
}
var sketchpadVisible = false;
function toggleSketchpad() {
    sigCanvas = document.getElementById('svg');
    punkt = sigCanvas.createSVGPoint();
    var frame = document.getElementById('slide-panel');
    if (sketchpadVisible) {
        sketchpadVisible = !sketchpadVisible;
        document.getElementById('sketch-panel').style.display = 'none';
        selectTool(null);
    }
    else {
        sketchpadVisible = !sketchpadVisible;
        selectTool('red');
        document.getElementById('sketch-panel').style.display = 'flex';
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
    undoButtons();
}
// Clear the canvas context using the canvas width and height
function clearCanvas(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
function undo() {
    if (undoIndex >= 0) {
        let top = undoStack[undoIndex];
        top.remove();
        undoIndex -= 1;
    }
    undoButtons();
}
function redo() {
    if (undoIndex < undoStack.length - 1) {
        undoIndex += 1;
        let top = undoStack[undoIndex];
        sigCanvas.appendChild(top);
    }
    undoButtons();
}
function undoButtons() {
    if (undoIndex >= 0)
        document.getElementById('sketch-undo').classList.remove('disabled');
    else
        document.getElementById('sketch-undo').classList.add('disabled');
    if (undoIndex < undoStack.length - 1)
        document.getElementById('sketch-redo').classList.remove('disabled');
    else
        document.getElementById('sketch-redo').classList.add('disabled');
}
// the main event dispatcher
function keyListener(event) {
    if (event.keyCode == '68') {
        //c
        toggleSketchpad();
    }
    if (event.keyCode == '85') {
        //u
        console.log('undo');
        undo();
    }
    if (event.keyCode == '73') {
        //i
        console.log('redo');
        redo();
    }
}
function selectTool(tool) {
    document.getElementById('sketch-red').classList.remove('selected');
    document.getElementById('sketch-blue').classList.remove('selected');
    //the red or blue pencil was chosen
    if (tool == 'red' || tool == 'blue') {
        document.getElementById('sketch-' + tool).classList.add('selected');
        selectedColor = tool;
    }
    else
        selectedColor = null;
}
function buttonClicked(event) {
    console.log(event.target.id);
    if (event.target.id == 'sketch-undo') {
        undo();
    }
    if (event.target.id == 'sketch-redo') {
        redo();
    }
    if (event.target.id == 'sketch-red') {
        selectTool('red');
    }
    if (event.target.id == 'sketch-blue') {
        selectTool('blue');
    }
}
document.getElementById('sketch-panel').addEventListener('click', buttonClicked);
document.addEventListener("keydown", keyListener);
//# sourceMappingURL=sketchpad.js.map