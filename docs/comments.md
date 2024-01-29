Slajdomat supports comments on slides. These are stored in a database, which is updated by a php script on your web server. To support comments in your slides, do the following.

### Step 1

Copy the directory src/comments to your server. The file comments.php in that directory is a php script, so it will only work on a web server, and calling it on localhost will not work. 

### Step 2

In the settings of the Slajdomat app, indicate the path leading to comments.php. This can be a relative or absolute path. For example, if the directory comments is in your presentations folder, then the path should be 
     
     comments/comments.php

If the directory comments is a sibling of your presentations folder, then the path should be 

    ../comments/comments.php

Or it could be an absolute url, such as 

    https://my.server.com/bigSlajdomatFan/comments.php



### Permissions
Make sure that the two files comments.php and comments.json have appropriate permissions. The php file should be executable and readable by whatever user you have in your web server (in my case, I had to make it readable by all and executable by its own user), and that the json file can be written to by the php. 
