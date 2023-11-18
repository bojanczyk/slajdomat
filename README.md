# slajdomat
This is a program for making zooming slides in Figma.

There are two parts: 
1. A plugin for Figma
2. An electron app, which saves the files from the plugin to the disk

The workflow is that you use the plugin to impose a tree structure on a drawing in figma. Then, you click an export button in the figma plugin, which sends the files to the app. The app creates a directory with html files display your slides, and you can copy this directory to your web page to share the slides or use them yourself. 

--- Use without compiling it

You can find a precompiled version of the app and the plugin in the releases section.

--- How to compile

Requires Node.js (for MacOS: better to use official pkg installer rather than brew)
To compile and build, do:

	npm install
	npm run make

 Once you have successfully built it, then the figma plugin will be in the figma-plugin directory, you can then use Figma to load a plugin from your own disk. The app will be in the out directory. 
