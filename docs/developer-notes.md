# Miscellaneous Developer notes

This file contains notes to the developer that may be useful in maintaning the app. This is separate from developer documentation, which should be created at some point.



## The toolchain

Generally speaking, the toolchain in web development is a mess with little documentation, and I am an amateur as well, so the toolchain here is a mess.


The source code is in typescript. The types from typescript are useful to avoid mistakes once the project is large. The program is constructed by a chain of three tools. 

- The first tool in the chain is the typescript transpiler, which generates javascript code from typescript.  The tsconfig.json file contains some typescript options, including options about the module system which are hard to understand (require vs import, the latter one is used here).
- The second tool in the chain is webpack, which makes the javascipt files smaller, and combines multiple files into single ones. Small files are useful for the generated presentations, while a single file is required for the figma plugin (and therefore webpack is useful, since it is much easier to spread out the figma plugin code throughout several files, including some files with code shared by other parts of the program).  Unfortunately, webpack is very flaky and unpleasant to use, with multiple cryptic configuration files.
- The third tool is electron, which is used for the app. This takes the javascript and hides in some subfolder of a copy of chrome so that it can pretend to be an app. It is built by a tool called "electron forge" which is, again, surprisingly unreliable.


## Development environment

Here is a description of my development environment. As an editor, I use vscode. It has excellent support for typescript, and you can have copilot in it, which is also very useful for web development.

### Working on plugin and viewer
When working on the plugin and viewer, I run 

    npm run watch

This checks for changes in the sources, and recompiles automatically. After recompiling, it invokes an extra script, called make-plugin-ui.sh, which which copies the viewer files to a directory called test-slides, and the plugin files to a directory called figma-plugin. 

If you are working on the figma plugin, you can chose the manifest in figma to be the one in your figma-plugin directory, and it will be recompiled and reloaded each time you make changes.

If you are working on the viewer, you can set your presentation directory to be the same directory that contains test-slides (and also package.json). Then you replace the contents of the test-slides directory with some previously created slajdomat presentation. This way, once you open that presentation in Slajdomat, its viewer will be automatically recompiled each time you edit the source codes. 

### Working on the electron

When working on the electron app, I use two options. One is 

    npm run start

This runs the electron app, and recompiles it while running. This is a good way to fool around with the html/css stiles without restarting the app each time. I have no idea what happens with the more advanced program logic after it is recompiled when running. I also do not know exactly what happens when "npm run start" and "npm run watch" are run at the same time, but I do it anyway. 

The other option, which I use to debug the actual program logic, is to run the electron app from the vscode debugger. 




## Notes on hacks used 
Notes about various hacks used in the setup. This may be common knowledge, but it can be easier to have them in one place for less professional developers such as Mikolaj.



### Code signing on mac

To distribute the binaries on mac, one needs to code sign. I guess that the proper way to do it is with a paid developer account. Without that account, macOS will raise a warning about the app being from an unidentified developer.

At least, that is how it works on intel macs. On an arm mac, if an app is not code signed, then the os will claim that the program is "damaged" and want to delete it. One can work around this by using something called "ad hoc" signing, which decorates the program with some kind of empty signature: 

    codesign --force --deep -s - Slajdomat.app

This will elimiate the "damaged" message, and allow the user to run the app once they have agreed to use it from an unidentified developer. 


## Todo
Things to implement in the future
zoom menu unfolds not just on arrow


### Bugs
search keywords are saved for last and not first slide event
css is bad for search results, the text overflows the white background

### Viewer app
- it would be nice to avoid the use of ffmpeg. I will try to use a js implementation of lame, or something similar. Gabriele suggested  https://recordrtc.org 



### Extra features of the system
- move event


