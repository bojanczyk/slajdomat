import { Database, PresentationNode } from "../common/types";
import { LatexPluginSettings, LatexState } from "./plugin-types";

export { PluginUIToCode, PluginCodeToUI };

//messages that are sent in the figma plugin, between its backend and its ui


//from ui to backend
type PluginUIToCode = {
  type: 'createEvent',
  subtype: 'show' | 'hide' | 'animate' | 'child',
  id: string,
  name: string
} | {
  type: 'settings',
  pluginSettings: LatexPluginSettings
} | {
  type: 'clickAnimateBar',
  index: number
} | {
  type: 'saveFile'
} | {
  type: 'changeRoot'
} | {
  type: 'mouseEnterPlugin'
} | {
  type: 'requestDropDown'
} | {
  type: 'mouseLeave'
} | {
  type: 'gotoSlide',
  which: 'parent' | { slideId: string }
} | {
  type: 'removeEvent',
  index: number
} | {
  type: 'mergeEvent',
  index: number
} | {
  type: 'hoverEvent',
  index: number
} | {
  type: 'clickEvent',
  index: number
} | {
  type: 'moveEvent',
  index: number,
  target: number
} | {
  type: 'makeFirst',
  width: number,
  height: number
} | {
  type: 'notify',
  text: string
} | {
  type: 'addWord',
  text: string
} | {
  type: 'latexit'
} | {
  type: 'latexitTwo',
  text: string
} | {
  type: 'drawTree'
}

// messages sent in the opposite direction, from the backend to the ui
type PluginCodeToUI = {
  type: 'savePresentation'
  name: string,
  slideList: {
    database: Database;
    svg: Uint8Array;
  }[],
  tree: PresentationNode
} | {
  type: 'selChange',
  selected: boolean,
  latexState: LatexState,
  canInsert: boolean,
  currentFont: FontName
} | {
  type: 'slideChange',
  docName: string,
  slide: string,
  hasParent: boolean,
  slideCount: number
} | {
  type: 'noSlide'
} | {
  type: 'settings',
  settings: LatexPluginSettings
} | {
  type: 'fetchlatex',
  url: string
} | {
  type: 'eventList',
  events: PresentationNode[],
  selected: number
} | {
  type: 'dropDownContents',
  slides: {
    name: string,
    id: string
  }[]
}