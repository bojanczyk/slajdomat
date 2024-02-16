/* takes care of the thumbnails of the slides in the plugin */
export { createThumbnail, updateThumbnails };
import { findSlide, slideId, state } from "./code";


function createThumbnail(sourceSlide: FrameNode, targetSlideId: string, where: Rect): GroupNode {
    const targetSlide: FrameNode = findSlide(targetSlideId);

    const redColor = {
        type: 'SOLID',
        color: {
            r: 1,
            g: 0,
            b: 0
        }
    } as Paint;

    // red semi-transparent rectangle, which will be later filled with the thumbnail
    const rectNode = figma.createRectangle();
    rectNode.resize(where.width, where.width);
    rectNode.x = where.x;
    rectNode.y = where.y;
    updateThumbnail(rectNode, targetSlide);
    rectNode.opacity = 0.5;
    rectNode.setPluginData('thumbnail', 'yes');
    state.currentSlide.appendChild(rectNode);

    // a red frame, which will stay even when the thumbnail appears
    const frameNode = figma.createRectangle();
    frameNode.resize(where.width, where.width);
    frameNode.x = where.x;
    frameNode.y = where.y;
    frameNode.fills = [];
    frameNode.strokes = [redColor];
    state.currentSlide.appendChild(frameNode);



    // E a group with the nodes
    const groupNode = figma.group([rectNode, frameNode], state.currentSlide);
    groupNode.setPluginData("childLink", targetSlideId);
    groupNode.expanded = false;

    return groupNode;
}

async function updateThumbnail(rect: RectangleNode, slide: FrameNode) {
    const image = figma.createImage(await slide.exportAsync({
        format: 'PNG'
    }));
    rect.fills = [
        {
            type: 'IMAGE',
            imageHash: image.hash,
            scaleMode: 'FILL'
        }
    ]
}


//update the thumbnails for slide children
async function updateThumbnails() {
    const nodes = state.currentSlide.findAll((node: SceneNode) => node.getPluginData("childLink") != '');

    for (const child of nodes) {
        const slide = findSlide(child.getPluginData('childLink'));

        //if the child link was created in an old version of Slajdomat, then it is simply a rectangle. In this case it needs to be upgraded to a new version, where it is a group containing two rectangles.
        if (child.type == 'RECTANGLE') {
            const where = { width: child.width, height: child.height, x: child.x, y: child.y };
            child.remove();
            createThumbnail(state.currentSlide, slideId(slide), where);
        }



        let rect: RectangleNode;
        //finds the rectangle where the thumbnail should go; this is indicated by plugin data
        if (child.type == 'GROUP') {
            for (const grandchild of child.children)
                if (grandchild.getPluginData('thumbnail')) {
                    rect = grandchild as RectangleNode;
                }
        }

        //if such a rectangle has been found, then its fill should be replaced with the thumbnail
        if (rect != null) {
            updateThumbnail(rect, slide);
        }
    }
}
