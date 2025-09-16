const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Handle the dynamic route for local_info
app.get('/clients/local_info/:zip/:timezone_offset', (req, res) => {
  // Send the index.html file for this route
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch-all to serve index.html for any other routes (e.g., direct access to index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
