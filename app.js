const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const bodyParser = require('body-parser');

const app = express();

//加入Session與Redis
const session = require('express-session');

app.use(session({
    secret: 'keyboard cat',
    cookie: { maxAge: 360000 }
}));


//加入MongoDB
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

mongoose.connect('mongodb://localhost/weeklyfocus');
const connection = mongoose.connection;

connection.on('error', console.error.bind(console, 'connection error:'));
connection.once('open', function () {
    console.log('mongodb connect!');

});

const index = require('./routes/index');
const api = require('./routes/api');
const admin = require('./routes/admin');
const webhook = require('./routes/webhook');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(require('node-sass-middleware')({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public'),
    indentedSyntax: true,
    sourceMap: true
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/api', api);
app.use('/admin', admin);
app.use('/webhook', webhook);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // handle CSRF token errors here
    console.log(err);
    if (err.code === 'EBADCSRFTOKEN') {
        return res.redirect('/?error=token');
    }
    res.status(403);
    res.json({err});
});

module.exports = app;
