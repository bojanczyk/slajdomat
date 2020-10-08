const mathFont = {
  family: 'STIXGeneral',
  style: 'Regular'
}
const symboltable = ['∀', '∃', '∧', '∨', '¬', '⊨', '×', '⟶', '↦', '∈', '∋', '∉', '∌', '⊆', '⊇', '≤', '≥', '∅', '⇒'];

var latexitSelection;

//the first stage of latexit, when we find the object to be latexed
function latexitOne() {
  if (figma.currentPage.selection.length > 0) {
    latexitSelection = figma.currentPage.selection[0];
    if (latexitSelection.type == 'TEXT'){
      var url = "https://latex.codecogs.com/svg.latex?"+encodeURIComponent(latexitSelection.characters);
      figma.ui.postMessage({
        type: 'fetchlatex',
        url: url
      });
      
      
    }
    else if (latexitSelection.type == "FRAME") {
      var text = figma.createText();
      latexitSelection.parent.appendChild(text);
      figma.loadFontAsync(text.fontName).then( x=>
      { try {var name = latexitSelection.name;
        name = name.slice(1);
        var i = name.lastIndexOf('$');
        text.characters = name.slice(0,i);
        var size = parseInt(name.slice(i+1));
        text.fontSize = size;
        text.x = latexitSelection.x;
        text.y = latexitSelection.y;
        latexitSelection.remove();
        figma.currentPage.selection = [text];}
        catch (error) {
          figma.notify("Could not delatex.")
        }
      })
    }
  }
}
//the second state of latexit, when we got the svg
function latexitTwo(svg) {
  console.log(svg);
  var node = figma.createNodeFromSvg(svg);
  const parent = figma.currentPage.selection[0].parent;
  parent.appendChild(node);
  /*
  var svgarray = [];
  for (const x of node.children[0].children) {
    parent.appendChild(x);
    svgarray.push(x);
  }
  var group = figma.group(svgarray, parent);
  node.remove();
  */
  var fontsize = latexitSelection.getRangeFontSize(0, 1);
  node.name = '$' + latexitSelection.characters + '$' + fontsize;
  node.rescale(fontsize * 0.065);
  node.x = latexitSelection.x;
  node.y = latexitSelection.y;
  latexitSelection.remove();
  figma.currentPage.selection=[node];
  
}

function selChange() {
  var sel = figma.currentPage.selection;
  var decision = "no-latexit";
  if (sel.length == 1) {
    if (sel[0].type == "TEXT")
      decision = "latexit";
    if (sel[0].type == "FRAME")
      if (sel[0].name[0] == '$')
        decision = "delatexit";

  }
  figma.ui.postMessage({
    type: 'selection',
    subtype : decision
  });
}

async function messageHandler(msg) {

  if (msg.type == 'latexit') 
    latexitOne();

  if (msg.type == 'svg') 
    latexitTwo(msg.svg);

  if (msg.type == 'error')
    figma.notify(msg.text);

  if (msg.type == 'non-latex') {
    var range = figma.currentPage.selectedTextRange;
    if (range != null) {

      let len = range.node.characters.length
      for (let i = 0; i < len; i++) {
        await figma.loadFontAsync(range.node.getRangeFontName(i, i + 1))
      }
        figma.loadFontAsync(mathFont).then(x => {
          var addedstring = msg.symbol;
          range.node.insertCharacters(range.start, addedstring + " ");
          var size = range.node.getRangeFontSize(range.start,range.start+1);
          range.node.setRangeFontName(range.start, range.start + addedstring.length, mathFont);
          range.node.setRangeFontSize(range.start, range.start + addedstring.length, size*0.75);
          console.log(size);
          //range.end = range.start +1;
          console.log(range.end);
          figma.currentPage.selectedTextRange = {
            node: range.node,
            start: range.start + addedstring.length + 1,
            end: range.start + addedstring.length + 1
          };
        });
      // 

    }
  }

};



figma.on("selectionchange", selChange);
figma.showUI(__html__);
figma.ui.resize(160, 200);
figma.ui.onmessage = messageHandler;
figma.ui.postMessage({
  type: 'symboltable',
  symboltable: symboltable
});
selChange();