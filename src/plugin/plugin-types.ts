import {
  SlideEvent
} from "../viewer/types"

import {} from '@figma/plugin-typings'

export {
  LatexPluginSettings,
  WindowMode,
  Database,
  LatexState,
  LatexitData,
  MessageToCode,
  MessageToUI,
}



//the structure which describes a slide
type Database = {
  name: string,
  id: string,
  events: SlideEvent[]
}


//these are the settings for the latex parte of the plugin, i.e. "matematyk", that are stored in the global plugin data
type LatexPluginSettings = {
  mathFontSize: number,
  mathFont: FontName,
  active: boolean,
  words: string[],
  serverURL : string,
  latexitURL : string
}

//the possible modes for the plugin
enum WindowMode {
  Settings,
  Slide,
  NoSlide
}

//the possible mode of the latex plugin
enum LatexState {
  None,
  Latex,
  Delatex
}

//this is the data stored in a node after it has been latexed
type LatexitData = {
  fontsize: number,
  code: string
}

//these are the possible messages that can be sent from the ui of the plugin to the backend of the plugin
type MessageToCode = {
  type: 'createEvent',
  subtype: string,
  id: string,
  name: string
} | {
  type: 'settings',
  pluginSettings: LatexPluginSettings
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
  type: 'gotoParent'
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
}

//messages sent in the opposite direction, from the backend to the ui
type MessageToUI = {
  type: 'savePresentation'
  name: string,
  slideList: {
    database: Database;
    svg: Uint8Array;
  } [],
  tree: SlideEvent
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
  isRoot: boolean,
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
  events: SlideEvent[]
} | {
  type: 'dropDownContents',
  slides: {
    name: string,
    id: string
  } []
}