import {
  PresentationNode
} from "../common/types"

import {} from '@figma/plugin-typings'

export {
  LatexPluginSettings,
  WindowMode,
  LatexState,
  LatexitData,
}




//these are the settings for the latex parte of the plugin, i.e. "matematyk", that are stored in the global plugin data
type LatexPluginSettings = {
  drawTree : boolean,
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
