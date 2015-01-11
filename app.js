var express = require('express');
var app = module.exports = express();
global.config = [];


app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  global.config.redis_secret = 'big secret'
  //global.config = require('./lib/config')
  global.config.status = 'dev';
});

app.configure('production', function(){
  app.use(express.errorHandler());
  global.config.gh_clientId = process.env.clientId;
  global.config.gh_secret = process.env.secret;
  global.config.redis_secret = process.env.redis_secret;

  global.config.mail_user = process.env.mail_user;
  global.config.mail_pass = process.env.mail_pass;

  global.config.status = 'prod';
});


var MACRO = require('./model/macro.js')
  , db = require('./model/db')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , everyauth = require('everyauth')
  , mongoose = require('mongoose')
  , core = require('./core.js')
  , cron = require('cron').CronJob;

// Refresh challenge cron job
var job = new cron(MACRO.CRON.CHALLENGE, function(){
    core.refresh_challenges();
  }, function () {}, true, false
);

everyauth
.everymodule
.findUserById( function (id, callback) {
  callback(null, global.usersById[id]);
});

everyauth
.github
.appId(global.config.gh_clientId)
.appSecret(global.config.gh_secret)
.findOrCreateUser(core.login)
.redirectPath('/');


app.configure(function() {
  app.set('admin', MACRO.SUPERUSER);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon(__dirname + "/public/images/rc-logo.ico"));
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: global.config.redis_secret,
    cookie: { maxAge: 1800000 } //30 min
  }));
  app.use(everyauth.middleware());

  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});


// routes defined here
var other = require('./routes/other.js');
app.get('/', other.index);
app.get('/login', other.login);
app.get('/login/:user', other.login);
app.get('/faq', other.faq);
app.get('/contact', other.contact);
app.post('/contact', other.feedback);

var profile = require('./routes/profile.js');
app.get('/:user/notifications', profile.notifications)

var challenge = require('./routes/challenge.js');
app.get('/challenges', challenge.index);
app.get('/challenges/:ch', challenge.one);
app.get('/challenges/:ch/admin', challenge.one);
app.post('/challenges/:ch/edit', challenge.edit);
app.post('/challenges/:ch/star', challenge.star);
app.post('/challenges/:ch/admin_add', ensureAuth, challenge.admin_add);
app.post('/challenges/:ch/email_users', ensureAuth, challenge.email_users);
app.get('/challenges/:ch/admin_remove', ensureAuth, challenge.admin_remove);
app.get('/challenges/:ch/repo_remove', ensureAuth, challenge.repo_remove);
app.get('/challenges/:ch/users', challenge.one);
app.get('/challenges/:ch/pulls', challenge.one);
app.get('/challenges/:ch/join', ensureAuth, challenge.join);
app.get('/challenges/:ch/refresh', ensureAuth, challenge.refresh);
app.get('/challenges/:ch/hide_commit', ensureAuth, challenge.hide_commit);
app.get('/challenges/:ch/display_commit', ensureAuth, challenge.display_commit);


var admin = require('./routes/admin.js');
app.get('/admin', ensureSuper, admin.index);
app.post('/admin/challenge_add', ensureSuper, admin.challenge_add);

/*
This handles all other URLs.
It's main porpose is to serve /user pages and all subpages
but also send 404 response if user does not exist.
*/
app.use(profile.index);


// Make sure user is authenticated middleware
function ensureAuth(req, res, next) {
  if (req.session.auth) return next();
  res.redirect('/login');
}

// Make sure user is authenticated and root middleware
function ensureSuper(req, res, next) {
  if (req.session.auth && MACRO.SUPERUSER.indexOf(req.session.auth.github.user.login) > -1)
    return next();

  return res.render('404', {title: "404: File not found"});
}

// Launch server
app.listen(process.env.PORT || 3000, function() {
  console.log('Server listening on port 3000.');
});
