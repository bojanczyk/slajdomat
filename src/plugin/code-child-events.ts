/* This file contains the code for creating child events in a slide. */

export { createChildEvent, createNewSlide, createThumbnail };

import { freshName, freshRect, sanitize } from "../common/helper";
import { Database, Slide } from "../common/types";
import { allSlides, findSlide, slideId, state } from "./code";
import { avoidList, newEventId } from "./code-name-management";
import { createThumbnail } from "./code-thumbnails";


//Creates a new slide of given width and height. The place for the new slide is chosen to be close to the current slide.
function createNewSlide(width: number, height: number, name: string): FrameNode {

    let basex, basey = 0;

    try {
        basex = state.currentSlide.x;
        basey = state.currentSlide.y;
    } catch (e) {
        //the slide might not be defined, or defined and removed
        basex = 0;
        basey = 0;
    }

    const place = freshRect(basex, basey, width, height, allSlides(), undefined);
    const newSlide = figma.createFrame();
    newSlide.name = name;
    newSlide.x = place.x;
    newSlide.y = place.y
    newSlide.resize(width, height);
    const id = freshName(sanitize(newSlide.name), avoidList(undefined));
    const database: Database = {
        name: newSlide.name,
        id: id,
        selected: undefined,
        events: [],
        originalParams: {}
    }
    newSlide.setPluginData("database", JSON.stringify(database));


    return newSlide;
}


//Creates a child event in the current slide, together with a child link (as described in the previous function) that represents the child. 
function createChildEvent(id: string): Slide[] {

    const slide: FrameNode = findSlide(id);
    const newEvent: Slide =
    {
        type: "child",
        id: id,
        name: slide.name,
        enabled: 'enabled',
        merged: false,
        children: [],
        keywords: [],
        eventId: newEventId(),
        originalParams: undefined
    }

    const newplace = freshRect(slide.width / 2, slide.height / 2, 100, 100 * slide.height / slide.width, state.currentSlide.children as FrameNode[], state.currentSlide);
    const thumbnail = createThumbnail(state.currentSlide, id, newplace);
    figma.currentPage.selection = [thumbnail];
    return [newEvent];
}
