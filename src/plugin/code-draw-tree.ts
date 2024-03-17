import { font } from "pdfkit";
import { Frame, Slide } from "../common/types";
import { allSlides, findSlide, getDatabase, getRoot, state } from "./code";

export { drawTree, deleteTree, presentationTree, unusedSlides }

type FrameNodeTree = {
    frame: FrameNode,
    merged: Boolean,
    children: FrameNodeTree[]
}



function presentationTree(): FrameNodeTree {

    function recursive(frame: FrameNode): FrameNodeTree {
        const retval = {
            frame: frame,
            merged: false,
            children: [] as FrameNodeTree[]
        }

        const database = getDatabase(frame);
        if (database != undefined) {
            for (const event of database.events) {
                if (event.type == 'child' && event.enabled == 'enabled') {
                    const childFrame = findSlide(event.id);
                    const childTree = recursive(childFrame);
                    childTree.merged = event.merged;
                    retval.children.push(childTree);
                }
            }
        }
        return retval;
    }

    const root = getRoot();
    const tree = recursive(root);
    return tree;

}

function widthOfTree(tree: FrameNodeTree): number {

    let childrenWidth = 0;
    for (const child of tree.children) {
        childrenWidth += widthOfTree(child);
    }

    return 1.2 * Math.max(tree.frame.width, childrenWidth);
}

type Point = {
    x: number,
    y: number
}

const annotationColors = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }] as Paint[];

function lineBetweenPoints(start: Point, end: Point): LineNode {
    const line = figma.createLine();
    line.x = start.x;
    line.y = start.y;


    let length = 1;
    if (start.x != end.x || start.y != end.y) {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        length = Math.sqrt((end.y - start.y) ** 2 + (end.x - start.x) ** 2);
        line.rotation = -angle * 180 / Math.PI;
    }

    line.resize(length, 0);
    line.strokeWeight = 20;
    // make the line grey
    line.strokes = annotationColors;

    line.setPluginData('annotation', 'line');


    // lock the line
    return line;
}



function reorganizeTree(tree: FrameNodeTree, lineList: LineNode[], corner: Point): Point {
    const childCenters = [] as Point[];

    const width = widthOfTree(tree);

    const height = Math.max(tree.frame.height * 1.5, width * 0.1);

    let currentX = corner.x + width * 0.1;

    let previousPoint = undefined;
    for (const child of tree.children) {
        const newPoint = reorganizeTree(child, lineList, { x: currentX, y: corner.y + height })

        // the line connects to the parent if not merged, and to the previous sibling if merged
        if (child.merged && previousPoint != undefined) {
            const line = lineBetweenPoints(previousPoint, newPoint);
            lineList.push(line);
        }
        else
            childCenters.push(newPoint);

        previousPoint = newPoint;
        currentX += widthOfTree(child);
    }


    const frameCenter = { x: corner.x + width / 2, y: corner.y + tree.frame.height / 2 };
    tree.frame.x = frameCenter.x - tree.frame.width / 2;
    tree.frame.y = frameCenter.y - tree.frame.height / 2;

    for (const childCenter of childCenters) {
        const line = lineBetweenPoints(frameCenter, childCenter);
        lineList.push(line);
    }

    return frameCenter;
}


function unusedSlides(tree: FrameNodeTree): FrameNode[] {


    const used: FrameNode[] = [];

    function recursive(tree: FrameNodeTree) {
        used.push(tree.frame);
        for (const child of tree.children) {
            recursive(child);
        }
    }
    recursive(tree);
    const unused: FrameNode[] = [];
    for (const slide of allSlides()) {
        if (!used.includes(slide)) {
            unused.push(slide);
        }
    }

    return unused;
}




function treeCount(tree: FrameNodeTree): number {
    let count = 1;
    for (const child of tree.children) {
        count += treeCount(child);
    }
    return count;

}

// organize the slides into a tree
async function drawTree() {
    // compute tree of all slides
    const tree = presentationTree();

    // delete all lines previously drawn
    deleteTree();



    // draw this tree, with the lines stored in lineList
    const lineList = [] as LineNode[];
    const point = reorganizeTree(tree, lineList, { x: 0, y: 0 });

    // groups need to be nonempty
    if (lineList.length == 0) {
        const fakeLine = lineBetweenPoints(point, point);
        lineList.push(fakeLine);
    }

    // create a group for the tree
    const group = figma.group(lineList, figma.currentPage);
    group.setPluginData('annotation', 'group');
    group.expanded = false;
    group.name = 'Slajdomat presentation tree annotation';
    figma.currentPage.insertChild(0, group);

    const height = Math.max(group.height, tree.frame.height);


    // create a caption for the tree
    const fontSize = height * 0.1;
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    const treeCaption = figma.createText();
    const number = treeCount(tree);

    treeCaption.characters = 'Presentation tree with ' + treeCount(tree) + (number == 1 ? ' slide' : ' slides');
    treeCaption.fontSize = fontSize;
    treeCaption.y = tree.frame.y - treeCaption.height * 3;
    treeCaption.x = point.x - treeCaption.width / 2;
    treeCaption.fills = annotationColors;
    group.appendChild(treeCaption);

    // create a section with unused slides
    const unused = unusedSlides(tree);
    if (unused.length > 0) {

        let unusedCaption = figma.createText();
        unusedCaption.fontSize = fontSize;
        unusedCaption.characters = 'Unused slides';
        unusedCaption.y = group.y + group.height + tree.frame.height + unusedCaption.height;
        unusedCaption.x = point.x - unusedCaption.width / 2;
        unusedCaption.fills = annotationColors;
        group.appendChild(unusedCaption);

        const x = group.x + group.width / 2 - tree.frame.width / 2;
        let y = unusedCaption.y + unusedCaption.height * 2;

        for (const slide of unused) {
            slide.x = x;
            slide.y = y;
            y += slide.height * 1.2;
        }

    }
    group.locked = true;

}

function deleteTree() {
    const groups = figma.currentPage.findAll(x => x.getPluginData('annotation') == 'group');
    for (const group of groups) {
        group.remove();
    }

}