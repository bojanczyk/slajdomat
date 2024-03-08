# Comments for slides

Slajdomat supports comments on slides. These are stored in a database, which is updated by a php script on your web server. To have comments in your slides, do the following. (I assume here that you already have your slides hosted on your web page. )

### Step 1

Copy the directory src/comments to your server. The file comments.php in that directory is a php script, so it will only work on a web server, and calling it on localhost will not work. 

### Step 2

In the settings of the Slajdomat app, indicate the path leading to comments.php. This can be a relative or absolute path. Relative means relative to your presentations folder, which is the one that contains all presentations.  

Let me explain this on an example. Suppose that your web page is in public_html, and you have placed your slajdomat presentations in sub-directory called slajdomat, as in the following example:

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

In this case, the presentations folder is slajdomat, and paths will be relative to that. Then you can 
For example, if the directory comments is in your presentations folder, then the path should be 
     
     comments/comments.php

If the directory comments is a sibling of your presentations folder, then the path should be 

    ../comments/comments.php

Or it could be an absolute url, such as 

    https://my.server.com/bigSlajdomatFan/comments.php



### Permissions
Make sure that the two files comments.php and comments.json have appropriate permissions. The php file should be executable and readable by whatever user you have in your web server (in my case, I had to make it readable by all and executable by its own user), and that the json file can be written to by the php. 
