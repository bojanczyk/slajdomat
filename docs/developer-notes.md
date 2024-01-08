# Miscellaneous Developer notes

This file contains notes to the developer that may be useful in maintaning the app. This is separate from developer documentation, which should be created at some point.

## Todo
Things to implement in the future

zoom menu unfolds not just on arrow
space for new slide is chosen around the origin, not around the parent slide

### Bugs

### Viewer app
- maybe sound can be handled on the app side, e.g. using https://recordrtc.org , so that ffmpeg can be avoided

### Plugin 
- check when a new live is created spuriously (not sure what that means anymore)


### Extra features of the system
- move event





### Parameters
If you run the app with command line parameters, then you can have a non-standard directory for the viewer files
Do it like this in macos: open Slajdomat --args ./directory_with_files




## The toolchain

Generally speaking, the toolchain in web development is a mess with little documentation, and I am an amateur as well, so the toolchain here is a mess as well.

The source code is in typescript. The types from typescript are useful to avoid mistakes once the project is large. The program is constructed by a chain of three tools. 

- The first tool in the chain is the typescript transpiler, which generates javascript code from typescript.  The tsconfig.json file contains some typescript options, including options about the module system which are hard to understand (require vs import, the latter one is used here).
- The second tool in the chain is webpack, which makes the javascipt files smaller, and combines multiple files into single ones. Small files are useful for the generated presentations, while a single file is required for the figma plugin (and therefore webpack is useful, since it is much easier to spread out the figma plugin code throughout several files, including some files with code shared by other parts of the program).  Unfortunately, webpack is very flaky and unpleasant to use, with multiple cryptic configuration files.
- The third tool is electron, which is used for the app. This takes the javascript and hides in some subfolder of a copy of chrome so that it can pretend to be an app. It is built by tools such as "electron forge" which are rather flaky as well.


There are options for npm to automatically recompile the software upon software changes using "npm run watch", but this has upredicatable results for me (i.e. often nothing happens), especially for the app, so I often simply do "npm run make" before running the app. A part of the toolchain that is more dependable is typescript, it can be run in Visual Studio Code by running  a watch process called "tsc: watch - tsconfig.json". The tsc tool gives good error messages.

Debugging the electron app is another mystery for me.


## Notes on hacks used 
Notes about various hacks used in the setup. This may be common knowledge, but it can be easier to have them in one place for less professional developers such as Mikolaj.



### Code signing on mac

To distribute the binaries on mac, one needs to code sign. I guess that the proper way to do it is with a paid developer account. Without that account, macOS will raise a warning about the app being from an unidentified developer.

At least, that is how it works on intel macs. On an arm mac, if an app is not code signed, then the os will claim that the program is "damaged" and want to delete it. One can work around this by using something called "ad hoc" signing, which decorates the program with some kind of empty signature: 

    codesign --force --deep -s - Slajdomat.app

This will elimiate the "damaged" message, and allow the user to run the app once they have agreed to use it from an unidentified developer. 
