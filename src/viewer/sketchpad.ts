export {
    toggleSketchpad, currentTool
};

//the possible tools are a red pencil and a blue pencil, and None means that drawing is inactive, in which case a highlighter is used

type Tool = 'red' | 'blue' | 'none'
let currentTool: Tool = 'none'

const undoStack: SVGElement[] = [];
let undoIndex = -1;



const drawState = {
    sigCanvas: undefined as SVGSVGElement,
    matrix: undefined as SVGMatrix,
    point: undefined as SVGPoint,
    curPath: undefined as SVGElement,
    curPathText: undefined as string,
    original: { x: 0, y: 0 },
    rect: undefined as SVGRectElement
}



function draw(event: Event): void {

    if (event.type == 'pointerdown') {
        drawState.sigCanvas = (document.getElementById('svg') as unknown) as SVGSVGElement;
        drawState.point = drawState.sigCanvas.createSVGPoint();
        drawState.matrix = drawState.sigCanvas.getScreenCTM().inverse();
        drawState.sigCanvas.addEventListener('pointermove', draw, false);
        drawState.sigCanvas.addEventListener('pointerup', draw, false);
    }

    drawState.point.x = (event as PointerEvent).clientX;
    drawState.point.y = (event as PointerEvent).clientY;
    drawState.point = drawState.point.matrixTransform(drawState.matrix);

    //if the sketchpad is not active, and hence we use the highlighter
    if (currentTool == 'none') {
        if (event.type == 'pointerdown') {
            drawState.original = { x: drawState.point.x, y: drawState.point.y };
            drawState.rect = document.createElementNS('http://www.w3.org/2000/svg', "rect");
            drawState.rect.setAttributeNS(null, 'x', drawState.point.x.toString());
            drawState.rect.setAttributeNS(null, 'y', drawState.point.y.toString());
            drawState.rect.setAttributeNS(null, 'fill', 'yellow');
            drawState.rect.setAttributeNS(null, 'opacity', '20%');
            drawState.sigCanvas.appendChild(drawState.rect);
        }
        if (event.type == 'pointermove') {
            let height = drawState.point.y - drawState.original.y;
            let width = drawState.point.x - drawState.original.x;
            let x, y: number;

            //negative height and width are not allowed, so we need to set the corner appropriately
            if (height >= 0) { y = drawState.original.y; }
            else {
                height = - height;
                y = drawState.point.y;
            }
            if (width >= 0) { x = drawState.original.x; }
            else {
                width = - width;
                x = drawState.point.x;
            }
            drawState.rect.setAttributeNS(null, 'x', x.toString());
            drawState.rect.setAttributeNS(null, 'y', y.toString());
            drawState.rect.setAttributeNS(null, 'height', height.toString());
            drawState.rect.setAttributeNS(null, 'width', width.toString());
        }

        if (event.type == 'pointerup')
            drawState.rect.remove();
    }

    //if the pen is the active tool
    if (currentTool == 'blue' || currentTool == 'red') {
        if (event.type == 'pointerdown') {
            drawState.curPath = document.createElementNS('http://www.w3.org/2000/svg', "path");
            drawState.curPathText = 'M ' + drawState.point.x + ' ' + drawState.point.y;
            drawState.curPath.setAttributeNS(null, 'd', drawState.curPathText);

            const color = currentTool == 'blue' ? 'blue' : 'red';
            drawState.curPath.setAttributeNS(null, 'stroke', color);
            drawState.curPath.setAttributeNS(null, 'stroke-width', drawState.matrix.a.toString());
            drawState.sigCanvas.appendChild(drawState.curPath);

            undoStack.splice(undoIndex + 1);
            undoStack.push(drawState.curPath);
            undoIndex += 1;
            undoButtons();
        }
        if (event.type == 'pointermove') {
            drawState.curPathText += ' L ' + drawState.point.x + ' ' + drawState.point.y;
            drawState.curPath.setAttributeNS(null, 'd', drawState.curPathText);
        }
    }

    if (event.type == 'pointerup' || event.type == 'pointerout') {
        drawState.sigCanvas.removeEventListener('pointermove', draw, false);
        drawState.sigCanvas.removeEventListener('pointerup', draw, false);
    }

}





function toggleSketchpad(): void {
    switch (currentTool) {
        case 'red':
        case 'blue':
            document.getElementById('sketch-panel').style.display = 'none';
            selectTool('none');
            break;

        case 'none':
            selectTool('red');
            document.getElementById('sketch-panel').style.display = 'flex';
            undoButtons();
            break;

        default:
            throw 'unsupported sketchpad case'
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
        drawState.sigCanvas.appendChild(top);
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
    if (tool == 'red') {
        document.getElementById('sketch-red').classList.add('selected');
    }
    else if (tool == 'blue') {
        document.getElementById('sketch-blue').classList.add('selected');
    }
    currentTool = tool;
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
        selectTool('red');
    }
    if (target.id == 'sketch-blue') {
        selectTool('blue');
    }

}

function initSketchpad() {
    document.getElementById('sketch-panel').addEventListener('click', buttonClicked);
    document.addEventListener("keydown", keyListener);

    if ('ontouchstart' in document.documentElement)
        document.getElementById('svg').addEventListener('touchmove', function (event: Event) {
            event.preventDefault();
        })
    document.getElementById('svg').addEventListener('pointerdown', draw, false);
}

initSketchpad();