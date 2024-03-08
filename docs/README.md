# User guide

Slajdomat is a tool for making zooming slides in Figma. You draw your slides in Figma, which is a good drawing program that can be used for free (you can also apply for an education plan which removes some limits of the free version). You use the Slajdomat plugin in Figma to annotate your picture with slide information (in what order the images should appear as slides). Then, you export the slides, with the result being html that you can upload to your website.

Once you have installed the software, see below for installation instructions, follow [this tutorial](tutorial.md) to get started.
You can also see the guides on how to
- [add comments to your slide](comments.md)
- [automate uploading the slides to your website](upload-script.md).
- record sound (no guide yet)

Main features
- uses Figma, a quality drawing program and free for basic use
- zoom in and zoom out
- allows recording sound
- produces html, hopefully not bloated
- has some math and latex support

## How to install

You will need the following software: 
-  **Figma**. This is available on Mac and Windows ([downloads](https://www.figma.com/downloads/)), and unofficially on  Linux ([downloads](https://github.com/Figma-Linux/figma-linux)). You can also use it as a web page, but this will not work on a plane/train, which is a typical slide making environment. Also, if you are using figma as webpage the plugin will allow you to create slides, but it will not allow you to publish them.
- **Slajdomat plugin in Figma.** You add Slajdomat to Figma by choosing the plugin in the &lsquo;Plugins&rsquo;&nbsp; menu of Figma. 
- **Slajdomat app.**  A standalone program, which will compile your slides, display them, and upload them to your webpage. You [can find compiled versions for Mac, Windows and Linux at github](https://github.com/bojanczyk/slajdomat/releases). Embarrassingly, the app is the size of chrome, since it contains a copy of chrome (this is how many cross-platform programs are developed nowadays).

## Compiling on your own
You can also choose to compile slajdomat on your own, and maybe even contribute to its source code (I would be delighted). To compile, you need to have node.js installed, then clone the repository, and then run  

    npm install
    npm run make





