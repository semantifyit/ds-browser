const express = require('express');
const path = require("path");
const app = express();

// disable cache
app.set('etag', false);
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// serve files
app.get('/css.css', function(req, res) {
    return res.sendFile(path.join(__dirname, '../', 'ds-browser.css'));
});

app.get('/ds-browser.js', function(req, res) {
    return res.sendFile(path.join(__dirname, '../dist/', 'ds-browser.js'));
});

// This route CAN be taken for locationControl: false
app.get('/', function(req, res) {
    return res.sendFile(path.join(__dirname, './', 'test-ds.html'));
});

// This route MUST be taken for locationControl: true when displaying a single ds, e.g. http://localhost:8080/ds/rQHgkTdOr
app.get('/ds/*', function(req, res) {
    return res.sendFile(path.join(__dirname, './', 'test-ds.html'));
});

// This route MUST be taken for locationControl: true when displaying a ds list, e.g. http://localhost:8080/list/wS4r3c9hQ?ds=47tJxjyLE
app.get('/list/*', function(req, res) {
    return res.sendFile(path.join(__dirname, './', 'test-ds.html'));
});

app.listen(8080);