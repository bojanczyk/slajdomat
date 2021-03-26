
export {
    toggleSketchpad, sketchpadVisible
};

//the possible tools are a red pencil and a blue pencil
enum Tool {
    Red,
    Blue
}

let is_touch_device: boolean;
let isDrawing = false;
let sigCanvas: SVGSVGElement;
let curPath: SVGElement;
let curPathText: string;
let selectedColor: string;


let matrix: SVGMatrix;
let punkt: SVGPoint;

const undoStack: SVGElement[] = [];
let undoIndex = -1;
let sketchpadVisible = false;

function draw(event: Event): void {



    if (event.type == 'touchstart' || event.type == 'mousedown') {
        if (selectedColor != null) {
            matrix = sigCanvas.getScreenCTM().inverse();
            isDrawing = true;
        }
    }


    if (isDrawing && event.type != 'touchend') {
        if (is_touch_device) {
            punkt.x = (event as TouchEvent).targetTouches[0].pageX;
            punkt.y = (event as TouchEvent).targetTouches[0].pageY;

        } else {
            punkt.x = (event as MouseEvent).clientX;
            punkt.y = (event as MouseEvent).clientY;
        }
        punkt = punkt.matrixTransform(matrix);
    }

    function addPoint() {
        curPathText += ' L ' + punkt.x + ' ' + punkt.y;
        curPath.setAttributeNS(null, 'd', curPathText);
    }

    if (event.type == 'touchstart' || event.type == 'mousedown') {
        curPath = document.createElementNS('http://www.w3.org/2000/svg', "path");
        curPathText = 'M ' + punkt.x + ' ' + punkt.y;
        curPath.setAttributeNS(null, 'd', curPathText);
        curPath.setAttributeNS(null, 'stroke', selectedColor);
        curPath.setAttributeNS(null, 'stroke-width', matrix.a.toString());
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
            isDrawing = false;
        }
    }

}





function toggleSketchpad(): void {
    sigCanvas = (document.getElementById('svg') as unknown) as SVGSVGElement;
    punkt = sigCanvas.createSVGPoint();

    if (sketchpadVisible) {
        sketchpadVisible = !sketchpadVisible;
        document.getElementById('sketch-panel').style.display = 'none';
        selectTool(null);
    } else {
        sketchpadVisible = !sketchpadVisible;
        selectTool(Tool.Red);
        document.getElementById('sketch-panel').style.display = 'flex';

        // This will be defined on a TOUCH device such as iPad or Android, etc.
        is_touch_device = 'ontouchstart' in document.documentElement;
        if (is_touch_device) {
            // attach the touchstart, touchmove, touchend event listeners.
            sigCanvas.addEventListener('touchstart', draw, false);
            sigCanvas.addEventListener('touchmove', draw, false);
            sigCanvas.addEventListener('touchend', draw, false);
            // prevent elastic scrolling
            sigCanvas.addEventListener('touchmove', function (event: Event) {
                event.preventDefault();
            }, false);
        } else {
            sigCanvas.addEventListener('mousedown', draw, false);
            sigCanvas.addEventListener('mousemove', draw, false);
            sigCanvas.addEventListener('mouseup', draw, false);
            // sigCanvas.addEventListener('mouseout', draw,false);
        }
    }
    undoButtons();
}


function undo(): void {
    if (undoIndex >= 0) {
        const top = undoStack[undoIndex];
        top.remove();
        undoIndex -= 1;
    }
    undoButtons();
}

function redo(): void {

    if (undoIndex < undoStack.length - 1) {
        undoIndex += 1;
        const top = undoStack[undoIndex];
        sigCanvas.appendChild(top);
    }
    undoButtons();
}


function undoButtons(): void {
    if (undoIndex >= 0)
        document.getElementById('sketch-undo').classList.remove('disabled')
    else
        document.getElementById('sketch-undo').classList.add('disabled')


    if (undoIndex < undoStack.length - 1)
        document.getElementById('sketch-redo').classList.remove('disabled')
    else
        document.getElementById('sketch-redo').classList.add('disabled')
}




// the main event dispatcher
function keyListener(event: KeyboardEvent): void {
    if (event.key == 'u') {
        undo();
    }
    if (event.key == 'i') {
        redo();
    }
}

function selectTool(tool: Tool): void {
    document.getElementById('sketch-red').classList.remove('selected');
    document.getElementById('sketch-blue').classList.remove('selected');

    //the red or blue pencil was chosen
    if (tool == Tool.Red) {
        document.getElementById('sketch-red').classList.add('selected');
        selectedColor = 'red';
    }
    else if (tool == Tool.Blue) {
        document.getElementById('sketch-blue').classList.add('selected');
        selectedColor = 'blue';
    }
    else
        selectedColor = null;
}


function buttonClicked(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.id == 'sketch-undo') {
        undo();
    }
    if (target.id == 'sketch-redo') {
        redo();
    }
    if (target.id == 'sketch-red') {
        selectTool(Tool.Red);
    }
    if (target.id == 'sketch-blue') {
        selectTool(Tool.Blue);
    }

}

document.getElementById('sketch-panel').addEventListener('click', buttonClicked);
document.addEventListener("keydown", keyListener);