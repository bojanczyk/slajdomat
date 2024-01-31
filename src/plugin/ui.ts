export {
  postMessage
}

import {
  LatexState,
  LatexPluginSettings,
  WindowMode
} from './plugin-types'

import {
  dragDrop,
  dragOver,
  dragStart
} from './ui-drag'



import {
  PresentationNode, Database
} from '../viewer/types'
import { PluginUIToCode, PluginCodeToUI } from './messages-ui-plugin';




// import 'material-design-icons/iconfont/material-icons.css'



// global variables  *******************

//prefix of dropdown id's
//this is meant to avoid coincidences with id's
const dropDownPrefix = "dropdown-prefix:";

//name of the figma document
// let docName :string;

//plugin settings
let pluginSettings: LatexPluginSettings;




// functions **************************

//********* settings *********/


function probeServer(): void {

  const statusDiv = document.getElementById('server-url-status') as HTMLDivElement;
  fetch(pluginSettings.serverURL, {
    method: 'POST',
    body: JSON.stringify({
      type: 'probe'
    })
  }).
    then(() => {
      statusDiv.innerHTML = "Status: connected."
    })
    .catch(() => {
      statusDiv.innerHTML = "Status: not connected."
    });
}



function getLatexSettings(settings: LatexPluginSettings): void {
  //create the matematyk panel, which allows to make latex and math symbols


  pluginSettings = settings;
  probeServer();

  const lengths = [0.8, 1, 1.2];
  for (let i = 0; i < lengths.length; i++) {
    if (pluginSettings.mathFontSize == lengths[i])
      (document.getElementById('math-font-size-select') as HTMLSelectElement).selectedIndex = i;
  }

  document.getElementById('current-insertion-font').innerHTML = pluginSettings.mathFont.family;


  if (pluginSettings.active) {
    document.getElementById('matematyk').style.display = '';
    document.getElementById('settings-matematyk').classList.remove('disabled');
  } else {
    document.getElementById('matematyk').style.display = 'none';
    document.getElementById('settings-matematyk').classList.add('disabled');
  }

  (document.getElementById('matematyk-checkbox') as HTMLInputElement).checked = pluginSettings.active;
  (document.getElementById('new-font-name') as HTMLButtonElement).disabled = !pluginSettings.active;
  (document.getElementById('math-font-size-select') as HTMLSelectElement).disabled = !pluginSettings.active;
  (document.getElementById('latexit-url') as HTMLInputElement).disabled = !pluginSettings.active;
  (document.getElementById('server-url') as HTMLInputElement).value = pluginSettings.serverURL;
  (document.getElementById('latexit-url') as HTMLInputElement).value = pluginSettings.latexitURL;

  document.getElementById('matematyk-words').innerHTML = '';
  for (const word of pluginSettings.words) {
    const button = document.createElement('div');
    button.classList.add('word-button');
    button.innerHTML = word;
    button.addEventListener('click', e => matematykSendWord((e.target as HTMLElement).innerHTML));
    document.getElementById('matematyk-words').prepend(button);
  }
}

function sendSettings() {
  postMessage({
    type: 'settings',
    pluginSettings: pluginSettings
  });
}




//columns are the alternative views for the plugin ui: 
//slide-column for editing a slide
//no-slide-column which allows making a new slide
//settings-column for the settings

let savedColumn: WindowMode //the previous column before entering settings. 

function showColumn(column: WindowMode): void {
  if (column != WindowMode.Settings)
    savedColumn = column;

  //first hide the other columns
  const allColumns = document.getElementsByClassName("column");
  for (const p of allColumns)
    p.classList.add("hidden");

  if (column == WindowMode.NoSlide)
    document.getElementById('no-slide-column').classList.remove("hidden");
  if (column == WindowMode.Slide)
    document.getElementById('slide-column').classList.remove("hidden");
  if (column == WindowMode.Settings)
    document.getElementById('settings-column').classList.remove("hidden");
}



//toggle the play button between "spinner" and "play"
function exportWaiting(waiting: boolean): void {
  const button = document.getElementById("spinner");
  if (waiting) {
    button.classList.remove('hidden');
  } else {
    button.classList.add('hidden');
  }
}


//send the presentation to the server
//this has to be done on the side of the ui, because only the ui has access to an internet connection
function savePresentation(presentation: {
  type: 'savePresentation'
  name: string,
  slideList: {
    database: Database;
    svg: Uint8Array;
  }[],
  tree: PresentationNode
}): void {
  //for some reason, TextDecoder does not work on the plugin side

  const newSlideList: {
    database: Database,
    svg: string
  }[] = [];

  for (const slide of presentation.slideList) {
    newSlideList.push({
      database: slide.database,
      svg: new TextDecoder("utf-8").decode(slide.svg)
    })
  }

  fetch(pluginSettings.serverURL, {
    method: 'POST',
    body: JSON.stringify({
      type: 'slides',
      presentation: presentation.name,
      slideList: newSlideList,
      tree: presentation.tree
    })
  }).
    then(() => {
      exportWaiting(false);
      notify("Successfully exported slides to the Slajdomat app.")
    })
    .catch(() => {
      notify("Not connected to the Slajdomat app. Make sure that it is running.");
      exportWaiting(false);
    });
}




//display a figma alert. Only the figma side can do this.
function notify(text: string): void {
  postMessage({
    type: 'notify',
    text: text
  })
}

//shortcut for posting a message, so that I don't need to write the '*' each time
function postMessage(msg: PluginUIToCode): void {
  parent.postMessage({
    pluginMessage: msg
  }, '*');
}


function changeSlide(msg: {
  type: 'slideChange',
  docName: string,
  slide: string,
  isRoot: boolean,
  slideCount: number
}): void {
  // docName = msg.docName;

  showColumn(WindowMode.Slide);
  document.getElementById('slide-name').innerHTML = msg.slide;

  //if the current slide is the root slide, then show the star
  if (msg.isRoot)
    document.getElementById('is-root-slide').style.display = '';
  else
    document.getElementById('is-root-slide').style.display = 'none';

  //display the number of slides (frames) in the presentation
  document.getElementById('slide-count').innerHTML = '' + msg.slideCount;

}






function eventIconClick(index: number): void {
  postMessage({
    type: 'clickEvent',
    index: index
  });
}

function eventRemoveClick(index: number): void {
  postMessage({
    type: 'removeEvent',
    index: index
  });
}

//we don't want to trigger the hover event just after the menu is closed, so we block it for a short time
let blockEventHover = false;
function foldMenu(menu: Element): void {
  menu.classList.remove('unfolded');
  blockEventHover = true;
}


function eventHover(index: number): void {
  if (blockEventHover) {
    blockEventHover = false;
    return;
  }
  else
    postMessage({
      type: 'hoverEvent',
      index: index
    })
}

//the button to merge events was clicked, we want to merge index with its predecessor (or de-merge)
function mergeEventClick(index: number): void {
  postMessage({
    type: 'mergeEvent',
    index: index
  })
}

//get the list of events for the current slide
function eventList(events: PresentationNode[], selected : number): void {

  //make a list item for the list of events 
  function makeEvent(event: PresentationNode, index: number): HTMLDivElement {
    
    const retval = document.createElement('div');
    retval.classList.add('list-item');
    retval.innerHTML = '<div class="animate-bar"></div><i class="material-icons"></i><div class="list-label"> </div><div class="list-buttons"><i class="material-icons">delete_outline</i></div>';


    retval.addEventListener('mouseenter', () => {
      eventHover(index)
    })
    retval.addEventListener('mouseleave', () => {
      eventHover(-1)
    })

    const animateBar = retval.querySelector('.animate-bar') as HTMLElement;
    if (selected == undefined || i >= selected)
      animateBar.classList.add('future');

    animateBar.addEventListener('click', (e) => {
      // check if the click is in the upper or lower half of the item
      const rect = retval.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.bottom - rect.top;
      const fraction = y / height;
      postMessage({
        type: 'clickAnimateBar',
        eventId: event.eventId,
        side: (fraction < 0.5) ? 'before' : 'after'
      })
    })

    const iconNode = retval.querySelector('i') as HTMLElement;
    iconNode.addEventListener('click', () => {
      eventIconClick(index)
    })

    const deleteButton = retval.querySelector('.list-buttons').childNodes[0] as HTMLElement;
    deleteButton.addEventListener('click', () => {
      eventRemoveClick(index)
    })

    if (event.enabled == 'disabled')
      retval.classList.add("disabled");

    switch (event.type) {
      case "show":
        iconNode.innerHTML = "visibility";
        break;
      case "hide":
        iconNode.innerHTML = "visibility_off";
        break;
      case "animate":
        iconNode.innerHTML = "animation";
        break;
      case "child":
        iconNode.innerHTML = "zoom_out_map";
        break;
      default:
        throw "unexpected event type"
    }

    const labelNode = retval.querySelector('.list-label') as HTMLElement;
    labelNode.innerHTML = event.name;
    return retval;
  }

  //make an item that separates two events
  function makeSpacer(event: PresentationNode, index: number, canMerge: boolean): HTMLDivElement {
    const div = document.createElement('div');
    div.classList.add('between-events');
    if (canMerge)
      div.classList.add('can-merge');
    let icon = 'link';
    if (event.merged) {
      div.classList.add('merged');
      icon = 'link_off'
    }
    div.innerHTML = '<i class="material-icons">' + icon + '</i>'
    div.childNodes[0].addEventListener('click', () => {
      mergeEventClick(index)
    });

    return div;
  }

  const eventListHTML = document.getElementById("event-list");
  eventListHTML.innerHTML = "";

  let i = 0;
  while (i < events.length) {
    const groupDiv = document.createElement('div');
    groupDiv.classList.add('dropzone');
    groupDiv.setAttribute('draggable', 'true');
    do {
      if (i > 0) {
        //an event can be merged with the previous one if either both are child events, or both are show/hide events
        let canMerge = false;
        if (events[i].type == 'child' && events[i - 1].type == 'child') {
          canMerge = true;
        }
        if (events[i].type != 'child' && events[i - 1].type != 'child') {
          canMerge = true;
        }
        groupDiv.appendChild(makeSpacer(events[i], i, canMerge));
      }
      groupDiv.appendChild(makeEvent(events[i], i));
      i++;
    } while ((i < events.length) && (events[i].merged))
    eventListHTML.appendChild(groupDiv);
  }
}

let fontCandidate: FontName = null;
//if the selection was changed in the ui, we need to disable/enable corresponding elements of the toolbar and dropdown. This function is triggered by a message from figma.
function selChange(msg: {
  type: 'selChange',
  selected: boolean,
  latexState: LatexState,
  canInsert: boolean,
  currentFont: FontName
}): void {


  const eventDropdowns = [
    'event-toolbar-show', 'dropdown-show-show', 'dropdown-show-hide', 'dropdown-show-animate'
  ]

  for (const i of eventDropdowns) {
    const dom = document.getElementById(i);
    if (msg.selected) {
      dom.classList.remove('disabled')
    } else {
      dom.classList.add('disabled')
    }
  }


  const fontButton = document.getElementById('new-font-name') as HTMLButtonElement;
  fontButton.disabled = (msg.currentFont == null);
  fontCandidate = msg.currentFont;
  if (fontCandidate != null)
    fontButton.innerHTML = fontCandidate.family;
  else
    fontButton.innerHTML = 'No font selected';


  //update the matematyk part 
  if (msg.canInsert) {
    document.getElementById('matematyk-input-container').classList.remove('disabled');
    document.getElementById('matematyk-words').classList.remove('disabled');
    (document.getElementById('matematyk-input') as HTMLInputElement).disabled = false;
  } else {
    document.getElementById('matematyk-input-container').classList.add('disabled');
    document.getElementById('matematyk-words').classList.add('disabled');
    (document.getElementById('matematyk-input') as HTMLInputElement).disabled = true;
  }

  if (msg.latexState == LatexState.None) //no object is selected, so the latex button should be disabled
  {
    document.getElementById('latex-button').classList.add('disabled')
  }

  if (msg.latexState == LatexState.Latex) //a text object is selected
  {
    document.getElementById('latex-button').classList.remove('disabled');
    document.getElementById('latex-button').innerHTML = 'attach_money';
  }

  if (msg.latexState == LatexState.Delatex) //a text object is selected
  {
    document.getElementById('latex-button').classList.remove('disabled');
    document.getElementById('latex-button').innerHTML = 'money_off';
  }
}


//the event handlers for the clicking on the buttons in the event toolbar, which create dropdowns 
const toolbarButtons = document.getElementsByClassName('event-toolbar-menu');
for (const toolbarButton of toolbarButtons) {
  toolbarButton.addEventListener('click', (event: MouseEvent) => {



    //returns the name of the icon associated to an item in the dropdown menu
    function getIconName(target: HTMLElement) {
      return target.querySelectorAll('i')[0].innerHTML
    }

    let target = event.target as HTMLElement;

    // if the input field was clicked, do nothing
    if (target.nodeName == 'INPUT')
      return;

    //go up the tree until you find a button
    function stoppingCriterion(target: HTMLElement) {
      return (target.nodeName == 'DIV' || target.classList.contains('hover-down-arrow'));
    }

    while (!stoppingCriterion(target)) {
      target = target.parentNode as HTMLElement;
    }



    if (target.classList.contains('hover-down-arrow')) {
      //the little drop-down arrow was clicked, which means that the visibility of the dropdown should be toggled

      if (toolbarButton.classList.contains('unfolded'))
        foldMenu(toolbarButton);
      else {
        //fold the other toolbars
        const buttons = document.getElementsByClassName('event-toolbar-menu');
        for (const otherToolbarButton of buttons)
          foldMenu(otherToolbarButton);
        //unfold the current one
        toolbarButton.classList.add('unfolded');
        //ask for a refresh of the dropdown contents
        postMessage({
          type: 'requestDropDown'
        });
      }
    } else {
      //some other part of the dropdown menu was clicked, possibly its content
      if (!target.classList.contains('disabled')) {
        //some item, not disabled, was clicked in the dropdown menu. We need to do what the item says

        //if the title was clicked, then we want to use the most recently clicked item from the menu
        if (target.classList.contains('updatedable-menu-title')) {
          //the most recently used menu item is identfied using the icon
          let iconName = toolbarButton.querySelectorAll('.menu-title-icon')[0].innerHTML; //this is the title icon for the toolbar
          let menuItems = toolbarButton.querySelectorAll('.row'); // these are all menu items
          for (let menuItem of menuItems as NodeListOf<HTMLElement>) {
            if (iconName == getIconName(menuItem))
              target = menuItem;
          }
        }


        //menu items for creating child slides 

        //the menu item that was clicked is creating a link to a new slide. In this case, we simply set the focus to the text field for that menu item
        if (target.id == 'dropdown-zoom-new') {
          document.getElementById('new-child-name').focus();
          return;
        }

        // the menu item that was clicked creates a link to an existing child
        if (target.id.startsWith(dropDownPrefix)) {
          const clickedId = target.id.slice(dropDownPrefix.length);
          createChildLink(clickedId);
          foldMenu(toolbarButton);
        }

        // creation of a new child is requested
        if (target.id == 'event-toolbar-zoom' || target.id == 'dropdown-zoom-new') {
          createChildLink(null);
          foldMenu(toolbarButton);
        }


        //remaining menus

        //this means that the menu used has an updateable icon, i.e. the title of the menu is the most recently used command. 
        if (toolbarButton.querySelectorAll('.updatedable-menu-title').length > 0) {
          toolbarButton.querySelectorAll('.menu-title-icon')[0].innerHTML = getIconName(target);
          //it so happens that items in menus with updateable icons require closing the menu
          foldMenu(toolbarButton);
        }

        //the menu item that was clicked is one for the show/hide events
        if (target.id.startsWith('dropdown-show-')) {
          showEventsClicked(target.id);
        }

        // exporting the slides is requested
        if (target.id == 'dropdown-export') {
          //this sets the menu icon to the selected element          
          exportWaiting(true);
          //this is a hack: I sleep for 10ms before calling save file. This is meant to solve the problem that, sometimes, the spinner only starts to run late in the loading process.
          setTimeout(() => postMessage({
            type: 'saveFile'
          }), 10);
        }

        // exporting the slides is requested
        if (target.id == 'dropdown-set-root') {
          postMessage({ type: 'changeRoot' });
          document.getElementById('is-root-slide').style.display = '';
        }

      }

    }
  });
}





//creates a link to a child with id, if id == null then a new child is created. Nothing is actually created by this code, only a request is sent to code.js
function createChildLink(id: string): void {
  const msg: PluginUIToCode = {
    type: 'createEvent',
    id: id,
    subtype: 'child',
    name: undefined as string
  };

  //if a new child is created, then its name is taken from the input field in the menu
  if (id == null) {
    msg.name = (document.getElementById('new-child-name') as HTMLInputElement).value;
  }
  postMessage(msg);
}


// what is done when the toolbar for show/hide events has been clicked. id is the id of the clicked dom element
function showEventsClicked(id: string): void {
  const subtype = id.slice('dropdown-show-'.length) as 'show' | 'hide' | 'animate' | 'child';
  postMessage({
    type: 'createEvent',
    subtype: subtype,
    id: undefined,
    name: undefined
  })
}



//get the contents for the Zoom dropdown menu for child slides
function dropDownContents(slides: {
  name: string,
  id: string
}[]): void {

  const zoomDropdown = document.getElementById('dropdown-zoom');

  //remove menu items that are child links
  const toDelete = [];

  for (const child of (zoomDropdown.childNodes)) {
    if ((child as HTMLElement).id != undefined)
      if ((child as HTMLElement).id.startsWith(dropDownPrefix))
        toDelete.push(child);
  }
  for (const child of toDelete)
    child.remove();



  //create new ones, based on the msg 
  for (const item of slides) {
    const child = document.createElement("div");
    child.classList.add('row');
    child.id = dropDownPrefix + item.id;
    child.innerHTML = '<i class="material-icons">zoom_out_map</i>' + item.name;
    zoomDropdown.appendChild(child)


  }
}



//functions for the matematyk plugin 
function matematykSendWord(w: string): void {
  postMessage({
    type: 'addWord',
    text: w
  })
}




function fetchLatex(url: string): void {
  document.getElementById("latex-button").classList.add("myspinner");
  fetch(url).then(x => {
    if (!x.ok) {
      throw "nic"
    } else return x.text()
  }).then(x => {
    parent.postMessage({
      pluginMessage: {
        type: 'latexitTwo',
        text: x
      }
    }, '*');
    document.getElementById("latex-button").classList.remove("myspinner");
  }).catch(() => {
    notify("Could not compile latex.");
    document.getElementById("latex-button").classList.remove("myspinner");
  })
}




//for some reason that I do not understand, the mouseleave is not paired with mouse enter, so I do this manually using the following variable
let cursorInsidePlugin = false;
//the plugin panel has been moused over

function pluginMouseenter() {
  if (!cursorInsidePlugin) {
    cursorInsidePlugin = true;
    postMessage({
      type: 'mouseEnterPlugin'
    })
  }
}


function pluginMouseleave() {
  cursorInsidePlugin = false;
  postMessage({
    type: 'hoverEvent',
    index: -1
  })
}




// handle messages coming from figma
onmessage =
  function (event: MessageEvent) {
    const msg = event.data.pluginMessage as PluginCodeToUI;

    switch (msg.type) {
      //reload the window when the slide changes
      case 'slideChange':
        changeSlide(msg);
        break;

      case 'noSlide':
        showColumn(WindowMode.NoSlide);
        break;

      //receive the settings 
      case 'settings':
        getLatexSettings(msg.settings);
        break;

      case 'fetchlatex':
        fetchLatex(msg.url);
        break;

      //get the list of events for the current slide
      case 'eventList':
        eventList(msg.events, msg.selected);
        break;

      //sends the svg files to the server. Apparently this cannot be done on the plugin side, since it requires internet connectivity.
      case 'savePresentation':
        savePresentation(msg);
        break;

      //the selection has been updated. This is used to disable or not items in the toolbar that make sense only if there is a selection
      case 'selChange':
        selChange(msg);
        break;

      //get the dropdown contents
      case 'dropDownContents':
        dropDownContents(msg.slides);
        break;

      default:
        throw "unexpected message type"
    }
  }





document.getElementById('entire-plugin').addEventListener('mouseenter', pluginMouseenter);
document.getElementById('entire-plugin').addEventListener('mouseleave', pluginMouseleave);

//here we check which buttons were clicked in the plugin
//this does not cover the dropdown menus 
document.addEventListener('click', (event: MouseEvent) => {
  const target = event.target as HTMLElement;

  switch (target.id) {
    case 'settings-button':
    case 'settings-button-two':
      //switch to the settings panel
      showColumn(WindowMode.Settings);
      break;

    case 'close-settings':
      //switch away from the settings panel
      showColumn(savedColumn);
      break;

    case 'make-first-small':
      //button to make a first slide, smaller size
      postMessage({
        type: 'makeFirst',
        width: 1024,
        height: 768
      })
      break;

    case 'make-first-big':
      //button to make first slide, bigger size
      postMessage({
        type: 'makeFirst',
        width: 1920,
        height: 1080
      })
      break;

    case 'new-font-name':
      //select the font for the matematyk plugin
      pluginSettings.mathFont = fontCandidate;
      sendSettings();
      break;

    case 'latex-button':
      //the user has clicked the latex / delatex button
      postMessage({
        type: 'latexit'
      });
      break;

    case 'find-app-in-github':
      window.open('https://github.com/bojanczyk/slajdomat/releases/', '_blank');

    default:
    //do nothing

  }
});

//if the user types Enter in the name of a new child in the dropdown, then the dropdown is closed and a link to that child is created
document.getElementById('new-child-name').addEventListener('keyup',
  function (event) {
    if (event.key == 'Enter') {
      createChildLink(null);
      foldMenu(document.getElementById('event-toolbar-zoom'));
    }

  }
)
//events for reordering the event list
document.addEventListener("dragstart", dragStart);
document.addEventListener("dragover", dragOver);
document.addEventListener("drop", dragDrop);

//when the settings were changed. This covers: clicking a checkbox, selecting from a select, typing enter into an input form
document.getElementById('settings-column').addEventListener('change',
  function () {


    pluginSettings.mathFontSize = parseInt((document.getElementById('math-font-size-select') as HTMLSelectElement).value) / 100;

    if ((document.getElementById('matematyk-checkbox') as HTMLInputElement).checked) {
      document.getElementById('matematyk').style.display = '';
    } else {
      document.getElementById('matematyk').style.display = 'none'
    }
    pluginSettings.active = (document.getElementById('matematyk-checkbox') as HTMLInputElement).checked;


    pluginSettings.serverURL = (document.getElementById('server-url') as HTMLInputElement).value;

    pluginSettings.latexitURL = (document.getElementById('latexit-url') as HTMLInputElement).value;

    sendSettings();

  }
)




//the user has filled in the math field, which should insert the contents of the math field into the currently selected text, in the font STIXGeneral
document.getElementById('matematyk-input').addEventListener('keyup',
  function (event) {
    if (event.key == 'Enter') {
      matematykSendWord((event.target as HTMLInputElement).value)
    }

  }
)