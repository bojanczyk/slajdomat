# slajdomat
This is a program for making zooming slides in figma.

There are two parts: 
1. A plugin for figma, which is in the figma-plugin directory
2. An electron app, which saves the files from the plugin to the disk

The workflow is that you use the plugin to impose a tree structure on a drawing in figma. Then, you click an export button in the figma plugin, which sends the files to the app. The app creates a directory with html files display your slides, and you can copy this directory to your web page to share the slides or use them yourself. 



--- HOW TO INSTALL

After installing Node.js run:

npm run installdev
npm run make

