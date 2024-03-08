# Comments for slides

Slajdomat supports comments on slides. These are managed by a script in that you will find in the src/comments directory, which has the following contents:

    comments
        comments.json
        comments.php

The comments.php script manages the list of comments made by users, which is stored in comments.json. (When the script is uploaded to your web server, as explained below, then make sure that the permissions are correct, i.e. the comments.json script is allowed to write to the comments.php script. )
 
 
 To have comments in your slides, do the following. I assume here that you already have your slides hosted on your web page, as discussed [here](upload-script.md).

### Step 1

Copy the directory src/comments to your server. The file comments.php in that directory is a php script, so it will only work on a web server, and calling it on localhost will not work. 

Where do you copy the src/comments directory?  Let us explain this on an example. Suppose that your web page is in public_html, and you have placed your slajdomat presentations in sub-directory called slajdomat, as in the following example:

    public_html
        ... other things on your web page ...
        slajdomat
            first_presentation
                index.html
                manifest.json
                ... other stuff in a presentation
            second_presentation
                index.html
                manifest.json
                ... other stuff in a presentation

In this case, the presentations folder is public_html/slajdomat, and paths will be relative to that. One solution would be to put to copy the src/comments directory as a sibling of your presentations folder, in which case your directory tree will look like this: 

    public_html
        ... other things on your web page ...
        comments
                comments.php
                comments.json
        slajdomat
            first_presentation
                index.html
                manifest.json
                ... other stuff in a presentation
            second_presentation
                index.html
                manifest.json
                ... other stuff in a presentation

Alternatively, you could put the comments directory as a child (and not sibling) of the presentations folder. One reason why you might want to use the first solution (sibling) instead of the second solution (child) is that if you use the git script discussed [here](upload-script.md) to upload your presentations folder to your web page, then the script will upload the comments from your local computer to your web server, which is the opposite of what you want (when users make comments to your slides, they will be added to the comments.json file).

### Step 2

In the settings of the Slajdomat app, indicate the path leading to comments.php. This can be a relative or absolute path. Relative means relative to your presentations folder. So, if you choose to put comments as a sibling of your presentations directory, as discussed in Step 1, then the relative path will be 

    ../comments/comments.php

If you choose to put comments as a child of your presentations directory, then the path will be

     comments/comments.php

Finally, you could put the comments directory anywhere, e.g. one some other server, and then use an absolute url, such as 

    https://my.server.com/bigSlajdomatFan/comments.php


