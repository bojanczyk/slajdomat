# Miscellaneous Developer notes

This file contains notes to the developer that may be useful in maintaning the app. This is separate from developer documentation, which should be created at some point.

## Todo
Things to implement in the future

### Viewer app
- maybe sound can be handled on the app side, e.g. using https://recordrtc.org , so that ffmpeg can be avoided

### Plugin 
- error when same name for slide and overlay
- check when a new live is created spuriously (not sure what that means anymore)


### Extra features of the system
- move event
- comments on slides









## Notes on hacks used 
Notes about various hacks used in the setup. This may be common knowledge, but it can be easier to have them in one place for less professional developers such as Mikolaj.

### Code signing on mac

To distribute the binaries on mac, one needs to code sign. I guess that the proper way to do it is with a paid developer account. Without that account, macOS will raise a warning about the app being from an unidentified developer.

At least, that is how it works on intel macs. On an arm mac, if an app is not code signed, then the os will claim that the program is "damaged" and want to delete it. One can work around this by using something called "ad hoc" signing, which decorates the program with some kind of empty signature: 

    codesign --force --deep -s - Slajdomat.app

This will elimiate the "damaged" message, and allow the user to run the app once they have agreed to use it from an unidentified developer. 
