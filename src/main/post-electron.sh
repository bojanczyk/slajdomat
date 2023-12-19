#!/bin/bash

# this script copies the resources directory to the application
# the resources contains, among others, the settings.json file
# unfortunately, the script needs to check for the operating system to know where the application is

os_name=$(uname -s)

if [ "$os_name" = "Linux" ]; then
    res_dir="out/Slajdomat-linux-x64/resources/app/"
elif [ "$os_name" = "Darwin" ]; then
    machine_arch=$(uname -m)
    # depending on the archictecture, either intel or arm, the target directory is different
    if [ "$machine_arch" = "arm64" ]; then
        res_dir="out/Slajdomat-darwin-arm64/Slajdomat.app/Contents/Resources/app/"
    elif [ "$machine_arch" = "x86_64" ]; then
        res_dir="out/Slajdomat-darwin-x64/Slajdomat.app/Contents/Resources/app/"
    else
    echo "Error: I know it is running Mac, but I'm unable to determine the architecture"
    fi
elif [ "$os_name" = "MINGW64_NT-10.0" ] || [ "$os_name" = "CYGWIN_NT-10.0" ]; then
    #dear windows user: I'm not sure if this is the right place
    res_dir="out/Slajdomat-win32-x64/resources/app/"
else
    echo "The system is not running Linux, macOS, or Windows."
fi

echo I am copying the resources to $res_dir
mkdir -p $res_dir 
cp -r resources $res_dir

# copy the most recent version of the viewer to the testing directory
cp resources/index.html resources/viewer.js test-slides/ 