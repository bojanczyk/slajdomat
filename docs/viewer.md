Each presentation is stored in a file called manifest.json. It contains  

## The tree

The presentation is stored in a tree. This tree has two kinds of nodes: 

    type PresentationNode = OverlayEvent | Slide


- An overlay node is a leaf in the tree, i.e. it cannot have children. It represents an event that manipulates the current slide, such as showing/hiding some piece of text.
- A slide node represents a slide and it can have children. There is a one-to-one correspondence between slide nodes and the atomic svg files that are stitched together by the viewer into one big svg file. Each slide has its sub-folder, which contains the svg and also sounds recorded for that slide.

In the manifest that describes a presentation, the tree is stored in the tree field:

    interface Manifest {
    ...
    tree: Slide,
    ...
    }

The tree does not store certain other information, such as sounds. 

## States

Typically a presentation is viewed by doing a traversal of the tree. You first display the root slide, then execute all the children, and finally you return to the root slide. We use the name "state" for a state of this traversal. There is one state for each overlay (after it has been executed) and two states for each slide (the start state, and the last one after all of its children have been executed). The type that describes states is


    type State = {
    type: 'start',
    slide: Slide
    } | {
    type: 'afterEvent',
    event: PresentationNode
    }

The 'start' part describes the state when we have just entered the slide and before we have run any of its children. Then 'afterEvent' part describes the state after executing each of its children (the children maybe overlays or states). 

## Timeline

In the viewer, the presentation is stored in a timeline, which is a list of pairs (state, sound for that state). The default timeline is a depth-first search traversal of the presentation tree, i.e. it contains each possible state exactly once. (Technically speaking, some states are removed from the timeline, because of "merging", but let's leave this out of the discussion.) However, you can create your custom timelines, where states appear multiple times, or zero times, with different sounds. The custom timelines (which are not implemented yet) arise from live recordings, where you might revisit a state several times.