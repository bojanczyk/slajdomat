<?php


//get the message from the 'message' query string parameter
$messageString = $_GET['message'];

// Parse the message string into an associative array
$message = json_decode($messageString, true);


// Check if the file comments.json exists, if not, create it and write an empty array
if (!file_exists('comments.json')) {
    if (file_put_contents('comments.json', '[]') === false) {
        echo 'could not create comments.json' . PHP_EOL;
        return;
    }
}

// Read comments from file
$data = file_get_contents('comments.json');
$comments = json_decode($data, true);

// echo $message['type'] . ''. $message['message'] . PHP_EOL;
switch ($message['type']) {
    case 'set':
        //set id to the maximal comment id + 1
        $message['comment']['id'] = max(array_map(function ($comment) {
            return $comment['id'];
        }, $comments)) + 1;

        array_push($comments, $message['comment']);
        if (file_put_contents('comments.json', json_encode($comments)) === false) {
            echo 'failed to write comments to file' . PHP_EOL;
        }
        else {
            echo 'successfully added comment'. PHP_EOL;
        }
        break;
    case 'get':
        $presentation = $message['presentation'];
        $filteredComments = array_filter($comments, function ($comment) use ($presentation) {
            return $comment['presentation'] === $presentation;
        });
        echo json_encode($filteredComments);
        break;

    default:    
        echo 'unknown command' . PHP_EOL;
        break;

}

?>