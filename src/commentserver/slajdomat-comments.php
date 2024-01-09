<?php
$servername = "kenny.mimuw.edu.pl";
$username = "bojan";
$password = "niDophFirkes";
$dbname = "bojan";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Get the type parameter from the request
$type = isset($_GET['type']) ? $_GET['type'] : '';

if ($type === 'insert') {
    // Handle comment insertion
    $presentation = $_GET['presentation'] ?? '';
    $comment_text = $_GET['comment_text'] ?? '';
    $who = $_GET['who'] ?? '';
    $slide = $_GET['slide'] ?? '';

    // Prepare and execute the SQL statement for inserting comments
    $stmt = $conn->prepare("INSERT INTO slajdomat_comments (presentation, comment_text, who, slide, date) VALUES (?, ?, ?, ?, CURDATE())");
    $stmt->bind_param("ssss", $presentation, $comment_text, $who, $slide);

    if ($stmt->execute()) {
        echo "Added comment";
    } else {
        echo "Error inserting comment: " . $stmt->error;
    }

    $stmt->close();
} elseif ($type === 'get') {
    // Handle comment retrieval
    $stmt = $conn->query("SELECT * FROM slajdomat_comments");
    $result = $stmt->fetch_all(MYSQLI_ASSOC);
    echo json_encode($result);
} elseif ($type === 'probe') {
   echo 'working';
} else {
    echo "Invalid type parameter. Use 'insert', 'get' or 'probe'.";
}

$conn->close();

?>