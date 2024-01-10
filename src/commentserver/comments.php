<!-- a wrapper that takes one agument, called message, passes it to the script comment-server.js, and returns its output -->
<?php
    $message = $_GET["message"];
    $output = shell_exec("ts-node comment-server.ts $message");
    echo $output;
?>
