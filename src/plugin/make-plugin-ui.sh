#!/bin/bash
#I tried to use the webpack instructions from https://www.figma.com/plugin-docs/bundling-webpack/ but this did not work, so I do my own script to generate the ui.html file

echo "Putting together the figma plugin files, in the figma-plugin directory" $Out


Out=figma-plugin/ui.html

cp dist/code.js figma-plugin/
cp src/plugin/ui.html $Out
echo "<script>" >> $Out
cat dist/ui.js >> $Out
echo "</script>" >> $Out
echo "<style>" >> $Out
cat src/plugin/ui.css >> $Out
echo "</style>" >> $Out

#copies the viewer files into the plugin. I tried to used extraResources of electron, but this did not do anything.
#this directory should be copied to
#AppDir="out/Slajdomat-darwin-x64/Slajdomat.app/Contents/Resources/app/"
cp dist/viewer.js resources/
cp src/viewer/slajdomat.html resources/index.html

#also copies the viewer slides into a directory for testing slides
#!/bin/bash
if [ ! -d test-slides ]; then
    mkdir -p test-slides
    echo "Created directory for testing slides"
fi

cp resources/* test-slides/


