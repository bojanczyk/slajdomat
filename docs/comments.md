Slajdomat supports comments on slides. These are stored in an sql database. To configure comments, you need to have access to some sql database. This means that you will have four things: a server name for the database, a username in it, a password, and a database name inside that database. 

Download the script [Slajdomat Comments PHP Script](https://github.com/bojanczyk/slajdomat/blob/master/src/commentserver/slajdomat-comments.php)

At the beginning of this script, place your four instead of the ones written in the downloaded script:
```bash
<?php
// these are only examples
$servername = "database.mimuw.edu.pl";
$username = "bojanczyk";
$password = "a password";
$dbname = "bojan";
```
Place this script in the root of your presentation directory. Since this script contains a password, it might be dangerous to use git to synchronize this script with your web page. 

In the settings in the app, turn on comments. 

