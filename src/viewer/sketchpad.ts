
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


    if (event.type == 'pointerdown') {
        if (selectedColor != null) {
            matrix = sigCanvas.getScreenCTM().inverse();
            isDrawing = true;
        }

        sigCanvas.addEventListener('pointermove', draw, false);
        sigCanvas.addEventListener('pointerup', draw, false);
    }

    if (isDrawing) {
        punkt.x = (event as PointerEvent).clientX;
        punkt.y = (event as PointerEvent).clientY;
        punkt = punkt.matrixTransform(matrix);
    }



    if (event.type == 'pointerdown' && isDrawing) {
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

    if (event.type == 'pointermove' && isDrawing) {
        curPathText += ' L ' + punkt.x + ' ' + punkt.y;
        curPath.setAttributeNS(null, 'd', curPathText);
    }


    if (event.type == 'pointerup' || event.type == 'pointerout') {
        if (isDrawing) {
            isDrawing = false;
        }

        sigCanvas.removeEventListener('pointermove', draw, false);
        sigCanvas.removeEventListener('pointerup', draw, false);
    }

}





function toggleSketchpad(): void {
    if (sketchpadVisible) {
        sketchpadVisible = !sketchpadVisible;
        document.getElementById('sketch-panel').style.display = 'none';
        selectTool(null);
    } else {
        sketchpadVisible = !sketchpadVisible;
        selectTool(Tool.Red);
        document.getElementById('sketch-panel').style.display = 'flex';
        undoButtons();
    }
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

function initSketchpad() {
    document.getElementById('sketch-panel').addEventListener('click', buttonClicked);
    document.addEventListener("keydown", keyListener);
    sigCanvas = (document.getElementById('svg') as unknown) as SVGSVGElement;
    punkt = sigCanvas.createSVGPoint();

    if ('ontouchstart' in document.documentElement)
        sigCanvas.addEventListener('touchmove', function (event: Event) {
            event.preventDefault();
        })
    sigCanvas.addEventListener('pointerdown', draw, false);
}

initSketchpad();