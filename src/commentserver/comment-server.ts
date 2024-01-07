import axios  from 'axios'

// Define the URL where insert_comment.php is hosted
const url = 'http://mimuw.edu.pl/~bojan/slajdomat-comments/insert_comment.php'; // Replace with the actual URL

// Define the data to be sent (presentation, comment_text, who, email)
const data = {
  presentation: 'Data Science Techniques 2',
  comment_text: 'The presentation was not informative and engaging.',
  who: 'Jane Smith',
  email: 'jane@example.com'
};

// Make the HTTP POST request using axios
axios.post(url, data)
  .then(response => {
    console.log('Response from insert_comment.php:', response.data);
  })
  .catch(error => {
    console.error('Error:', error);
  });